# Pitch, video and submission (Joshua, not for the build agents)

## Judges to keep in mind

The judge and mentor list includes the founder of XOXNO and the founder of Zenith Protocols (Blend and Zenex), plus a large SDF group (DevRel, product, ecosystem, protocol engineering). DeFindex is an official partner. Framing: Peridot is the layer that lets any token plug into Blend, XOXNO, DeFindex and Aquarius liquidity. Never frame any of them as a competitor; say "routes into".

## Demo video (record Mon 08:00 to 10:00, after code freeze)

Target 3:00, hard max 4:00, 1080p screen recording with voice, captions, YouTube unlisted. Backup recording Sunday night.

| Time | Screen | Say |
|---|---|---|
| 0:00 to 0:20 | Landing hero | Problem in two sentences, the one-liner. Adoption first. |
| 0:20 to 0:35 | Prior work table | Peridot is live on Stellar; this is what we built this weekend. |
| 0:35 to 1:35 | `/launch` on **mainnet** | Two markets configured differently: USDC 20% liquid routed to Blend, XLM with a 0% borrow rate routed to DeFindex; own reward token with emissions per market; leverage 3x. Later phases: Aquarius LP vault, XOXNO, price guard. Launch, show tx list. |
| 1:35 to 2:10 | `/groups/[id]` | Supply, funds land in Blend, claim rewards, open 2x long; if phase 2 landed, keeper harvest and loss reserve. Click at least two mainnet txs on stellar.expert. |
| 2:10 to 2:30 | Control Panel | Add a market after launch, change buffer, borrow rate and reward speed, guardrail rejects CF 90%, history list. |
| 2:30 to 2:45 | Architecture | Audited core reused (only timelocks shortened for the hackathon); three seams: any yield venue through one vault interface, any price source through one oracle interface, any reward token through one distributor. |
| 2:45 to 3:00 | Roadmap | Already on mainnet; next: audit of the new contracts, multisig upgrades, first partner groups, SCF. Close on the one-liner. |

## Deck (12 slides max, PDF to `docs/assets/deck.pdf`)

Peridot design system, Arial, left-aligned, one idea per slide. Same deck for async judging and the live finalist pitch (prepare 3 and 5 minute cuts).

1. Title: one-liner, Scale + Stellar Composed, live URL.
2. Problem: new tokens and dApps cannot get lending, borrowing or leverage without months of listing work; their idle liquidity earns nothing.
3. Solution: launch an isolated market group, configure each market (rate curve incl. 0%, risk, liquid buffer, yield route, price source, leverage, rewards in your own token), add markets and manage everything in a Control Panel. Live on mainnet.
4. Routes into Stellar's best yield: Aquarius, Blend, Zenex, XOXNO, DeFindex, with a one-line factual description each.
5. How it works: audited core reused (timelocks shortened for the hackathon), three seams (vault interface, price router, reward distributor), factory guardrails.
6. Demo screenshots with tx links.
7. Built at HackMeridian: intake milestones vs delivered; prior work vs new.
8. Safety: isolation, caps, Reflector-first pricing with Aquarius deviation guard, no admin fallback prices, owner acts only within guardrails, loss reserve capped.
9. Ecosystem impact: every new token gets a money market; more deposits flow into Blend, XOXNO, DeFindex and Aquarius; Reflector usage grows.
10. Business model: [confirm numbers] protocol share of interest, Blend fee-vault admin fee, LP vault performance fee, margin trading fee share (phase 3), hosted keeper subscription; revenue to $P stakers.
11. Go-to-market: first groups [named Stellar projects], partner co-marketing, SCF.
12. Team and traction: SDF Build Award #43, Stellar Kickstart #11, AWS x Techstars, Halborn audit, hackathon record, live on mainnet, contact.

## Submission

Submit right after phase 1 is tagged (Sun evening) if the portal allows editing, then update after each phase. Final pass Mon 10:30 to 11:30:

- Fill the form answers in founder voice, mapped to Scale criteria (milestones, SCF eligibility, production readiness, ecosystem impact).
- Links: `PeridotFinance/peridot-markets` repo, live mainnet URL, video, deck PDF, docs/DEMO.md.
- Open every link from a logged-out browser. Submit by 11:30.
