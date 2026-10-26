# Wallet connect and signing review

Branch `qa-wallet`, based on main a3d0b85. Reviewed by code reading, the installed Stellar Wallets Kit 2.7.1 and `@albedo-link/intent` 0.12.0 sources, and Playwright (Chromium and WebKit) with an Albedo protocol fixture. No real wallet, key or transaction was used.

## Ruled out: user gesture loss (verified, not the cause)

Connect and every Albedo signing prompt reach `window.open` synchronously inside the click: `connect` -> `connectKit` -> `WalletRequest.run` -> `kit.fetchAddress` -> `AlbedoModule.getAddress` -> `albedo.publicKey` -> `createDialogTransport` -> `window.open`. Signing is deliberately a second click ("Open Albedo to sign") after simulation, so no network await sits between a click and the popup. Evidence: `navigator.userActivation.isActive` was `true` at every `window.open` call in Chromium and WebKit (`popupGestures` is `[true]` for connect and `[true,true]` for connect plus sign). Freighter is an extension and needs no gesture. No `Cross-Origin-Opener-Policy` or CSP header exists in `next.config.ts` or the served responses (asserted in `tests/wallet-qa.ts`); Vercel adds none by default, confirm in DevTools, Network, first document, Response headers. `web+stellar-handler` in the Albedo library does not call `registerProtocolHandler`, so Safari is fine. The `tx` intent forwards both `pubkey` and `network`.

Albedo origin and cookies: there is no origin allow-list to configure. Albedo shows the requesting origin on its confirm screen, and every Vercel preview URL is a new origin, so expect a fresh approval prompt per preview URL. The Albedo window is top-level (`window.open`), not an iframe, so third-party cookie blocking and Vercel preview protection cookies do not apply; the iframe transport is used only for implicit sessions, which the app never requests.

## Findings, most likely cause first

1. **Hard 60 s timeout against a first-time Albedo login.** `WalletRequest.run` defaulted to 60 s and Albedo's library never rejects when its window closes (`transportCloseHandler` is never wired). A fresh browser profile means logging in or importing the account inside Albedo. When the user finished after 60 s, the app had already shown "did not respond", discarded the late reply, and the library then closed his Albedo window. Reproduced on the old build: a 65 s delayed reply fails; on the new build it connects. Fixed: connect timeout 5 min, signing timeout `min(5 min, transaction timebound minus 10 s)`.
2. **Blocked or hidden popup looked like a 60 s hang.** A per-site popup block (or Safari opening the window behind the page) produced no message for a minute. Fixed: `window.open` is wrapped for the duration of the synchronous wallet call; a `null` result fails at once with "Allow pop-ups for this site...", otherwise the window is focused. Only the Albedo path is watched, so Freighter is never reported as blocked.
3. **Closing the Albedo window hung for 60 s.** Now detected by polling `popup.closed` (1 s grace so Albedo's own close after a reply is not misreported) and reported as "closed before it responded". During signing this keeps the reviewed transaction in the dialog with a "Try again" button, with no re-simulation. Cancel and timeout now also close the window the app opened.
4. **Dead end when the wallet module fails to load.** The button stayed "Loading wallet..." and disabled forever. Now it becomes "Connect wallet" with the load error, and a click retries the load.
5. **Disconnected action buttons were dead.** Enable market, Supply/Withdraw/Borrow/Repay, Claim rewards and Review position were disabled with no hint. They now read "Connect wallet" and open the connect flow inside the click. Launch wizard and control panel already had one.
6. **Freighter specifics.** "Freighter is not connected" is now "Freighter was not detected. Install and unlock the extension, allow it on this site, reload, or choose Albedo." Declines read "You declined the request in Freighter/Albedo. Nothing was signed." After switching Freighter's network, the mismatch banner cleared only on reconnect; it now re-checks when the tab regains focus, and the banner says what to do.
7. **429 on `sendTransaction`.** A rate limit threw `UnknownTransactionError` after the pending record was saved, blocking all writes until the envelope expired (about 3 min). Now retried twice with the identical signed envelope (same hash, idempotent) before declaring the outcome unknown. No other submit or ordering logic changed.
8. **Wallet choice did not persist.** Stored in `localStorage` key `peridot:wallet` (Albedo stays the default; storage failure is ignored).

## Not changed, by design

- Transaction `setTimeout(180)` in `rpc.ts` is untouched (transaction semantics). Budget: simulation, reading the dialog and the wallet login all share those 180 s minus 10 s; a very slow first Albedo login can still hit "Transaction expired. Review the action again." That is safe, retry from the button.
- The kit writes `localStorage` without guards (`state/effects.js`); Safari with all site data blocked cannot use the app anyway (pending-transaction storage is required). The load error now says so.
- `navigator.locks`: a sign dialog left open in another tab gives "Another tab is handling this wallet." Close the other tab.
- Albedo support for Soroban `invokeHostFunction` envelopes in its confirm screen cannot be verified without the real service. If Albedo cannot display or sign it, use Freighter.

## What I could not verify without a real wallet

Real Albedo account login and signature of a Soroban transaction; real Freighter connect, network check and signature; real Safari popup policy; the Vercel preview's response headers.

## Two-minute check for Joshua

Browser settings first: allow pop-ups for the preview site (Chrome: lock icon, Site settings, Pop-ups and redirects, Allow; Safari: Settings, Websites, Pop-up Windows, set this site to Allow; Firefox: Settings, Privacy, Permissions, Exceptions). Do not use a private window. Open the preview, signed into Vercel.

1. Press **Connect wallet** (Albedo). The Albedo window must open at once. Log in; take as long as needed. The button shows the first and last four characters of the account.
2. Close the Albedo window on purpose before finishing a second connect: within about 2 seconds the banner says it was closed. Press Connect again.
3. Open group 1, Manage XLM, press **Enable market**, wait for "Ready to sign with Albedo", press **Open Albedo to sign**, review and sign. Expect "confirming" then success.
4. Switch the provider to Freighter (Disconnect first), reload: Freighter must still be selected. Connect, sign the same step once with Freighter on mainnet.
5. If Albedo shows an error for the transaction itself, note its text and repeat step 3 with Freighter.

## Tests added

- `src/wallet/request.test.ts`, `src/wallet/kit.test.ts`: blocked, closed, late-reply, no-window, cancel/timeout close, restore of `window.open`, error wording, timebound-aware signing window.
- `tests/wallet-qa.ts`: slow login (65 s) accepted, closed window, blocked popup, no COOP/CSP, persisted choice, missing Freighter, disconnected action button connects inside the gesture. Run: build with `NEXT_PUBLIC_USE_MOCKS=false`, start on a free port, then `WALLET_TEST_URL=http://127.0.0.1:PORT WALLET_TEST_BROWSER=chromium|webkit node --import tsx tests/wallet-qa.ts` (`WALLET_TEST_SKIP_CHAIN=1` skips the check that needs the public RPC).
- `tests/browser-wallet-popup.ts`: blocked-popup expectation updated to the fast message; added refused signing popup then "Try again".
