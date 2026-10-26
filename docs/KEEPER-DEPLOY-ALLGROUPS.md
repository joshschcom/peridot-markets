# Deploy the all-groups keeper (for Joshua)

Replaces the group-1-only service `peridot-keeper-group1` on the keeper droplet (`165.245.251.79`) with `peridot-keeper-upkeep`, which keeps interest accrued and boosted caches fresh for every group the market factory lists (today groups 1, 2 and 3). Code lives on branch `keeper-all-groups`; design and safety rules are in [KEEPER.md](KEEPER.md#all-groups-upkeep-mode). Nothing here has been run on the droplet by the agent that prepared it. Every step below is yours to run.

## What changes

| | Before (`group-main`, group 1 only) | After (`upkeep-main`, all groups) |
|---|---|---|
| Group 1 interest and XLM boosted refresh | yes, every 2 min | yes (interest every 10 min, boosted every 2 min) |
| Group 2 (rewards) interest | no | yes |
| Group 3 (Blend) interest and boosted refresh | no, borrows fail | yes |
| New user groups and markets | no | yes, picked up within 5 min if their code matches the pins |
| Margin and ordinary lending liquidation | yes (nothing to do today) | NO, dropped |

Dropping liquidation costs nothing today: the margin position counter is 0 and no repay inventory or allowance exists (`LENDING_REPAY_CAPS_JSON='{}'`), so no liquidation could run anyway. Re-enabling it is a separate decision (run `group-main` again, which cannot share the signing key with upkeep at the same time).

Expected cost: about 2.4 XLM per day on chain. The journal reserves a padded amount, 7.74 XLM per rolling 24 h, against the existing 10 XLM cap (`MAX_FEE_24H_STROOPS=100000000`), so the cap stays as it is. The keeper account held 29.41 XLM at the audit: about 12 days of runway, so top it up or watch `/status` before then.

## Step 0, now: refresh group 3's boosted cache by hand

Group 3's cache is about 11 hours old, so borrows on it fail until it is refreshed. Run this from your Mac, in any clone of the repo, with the admin identity. Never use `peridot-mainnet-keeper` here: a manual transaction from the keeper account while the service is running changes its sequence number and makes the service stop signing.

```sh
cd ~/Peridot/peridot-markets-keeperall      # any clone with scripts/refresh_boosted_mainnet.sh
scripts/refresh_boosted_mainnet.sh peridot-mainnet-admin
```

It refreshes the group 1 XLM vault and the group 3 Blend vault (about 0.002 XLM each) and prints one stellar.expert line per vault. Group 1 is harmless to poke again. To refresh only group 3:

```sh
STELLAR_INCLUSION_FEE=2000 stellar contract invoke --id CCUQUYBW3LJXPYB5U5QIDBDWPMKYVBPCIHQZSSXOSAV2SIXOBDNHSUDM \
  --source-account peridot-mainnet-admin --network mainnet-gateway -- refresh_boosted_underlying
```

The cache lasts 5 minutes, so borrows on group 3 work for about 5 minutes after this; the service below keeps it fresh afterwards.

## Step 1: ship the exact commit to the droplet (new directory, old install untouched)

On your Mac, in a clone of the repo:

```sh
git fetch origin keeper-all-groups
SHA=$(git rev-parse origin/keeper-all-groups); echo "$SHA"
git archive --format=tar.gz -o /tmp/peridot-upkeep.tgz "$SHA" keeper/liquidator/margin deployments
export DROPLET=165.245.251.79 DROPLET_USER=root            # use the login you normally use for this droplet
export SSH_KEY=~/.ssh/peridot-keeper-droplet
scp -i "$SSH_KEY" /tmp/peridot-upkeep.tgz "$DROPLET_USER@$DROPLET:/tmp/"
ssh -i "$SSH_KEY" "$DROPLET_USER@$DROPLET"
```

On the droplet (the rest of the steps run there; prefix with `sudo` if you are not root):

```sh
# Inspect what is running now. Expect ExecStart, WorkingDirectory=/opt/peridot-markets/..., EnvironmentFile=/etc/peridot-keeper/group1.env
sudo systemctl cat peridot-keeper-group1
sudo mkdir -p /opt/peridot-markets-upkeep
sudo tar -xzf /tmp/peridot-upkeep.tgz -C /opt/peridot-markets-upkeep
# Same lockfile as the running install, so reuse its dependencies instead of downloading again.
diff /opt/peridot-markets/keeper/liquidator/margin/package-lock.json /opt/peridot-markets-upkeep/keeper/liquidator/margin/package-lock.json && echo "lockfile identical"
sudo cp -a /opt/peridot-markets/keeper/liquidator/margin/node_modules /opt/peridot-markets-upkeep/keeper/liquidator/margin/node_modules
sudo chown -R root:root /opt/peridot-markets-upkeep && sudo chmod -R go-w /opt/peridot-markets-upkeep
```

If the `diff` prints anything, run `cd /opt/peridot-markets-upkeep/keeper/liquidator/margin && sudo npm ci --omit=dev` instead of the `cp`. Match the ownership of `/opt/peridot-markets` if it is not root-owned (`ls -ld /opt/peridot-markets`).

## Step 2: private env file

```sh
sudo cp -p /etc/peridot-keeper/group1.env /etc/peridot-keeper/upkeep.env      # keeps owner and mode
sudo sed -i -E '/^(GROUP_ID|LENDING_[A-Z_]+|STATE_FILE|EXPECTED_CONTROLLER_WASM_HASH|DRY_RUN|RUN_ONCE|BOOSTED_REFRESH_INTERVAL_MS|INTEREST_REFRESH_INTERVAL_MS)=/d' /etc/peridot-keeper/upkeep.env
printf '%s\n' 'GROUP_IDS=all' 'DRY_RUN=false' 'RUN_ONCE=false' 'BOOSTED_REFRESH_INTERVAL_MS=120000' \
  'INTEREST_REFRESH_INTERVAL_MS=600000' 'UPKEEP_MAX_TX_FEE_STROOPS=200000' | sudo tee -a /etc/peridot-keeper/upkeep.env >/dev/null
# Show key names only, never values. Expect LIQUIDATOR_SECRET, DATABASE_URL, DATABASE_CA_FILE, RPC_URL, LIQUIDATOR_PUBLIC_KEY,
# MAX_TRANSACTION_FEE_STROOPS, MAX_FEE_24H_STROOPS=..., MIN_FEE_BALANCE_STROOPS, PORT, HOST plus the lines added above.
sudo cut -d= -f1 /etc/peridot-keeper/upkeep.env
sudo grep -E '^(MAX_FEE_24H_STROOPS|PORT)=' /etc/peridot-keeper/upkeep.env      # expect 100000000 and 8788
```

## Step 3: dry run on the droplet while the old service keeps running

A dry run holds no database lock, signs nothing and needs no journal, so it can run next to the live service. It runs as root only so it can read the env file.

```sh
NODE=$(sudo systemctl show -p ExecStart peridot-keeper-group1 --value | grep -o 'path=[^ ;]*' | head -1 | cut -d= -f2); echo "$NODE"
cd /opt/peridot-markets-upkeep/keeper/liquidator/margin
sudo env DRY_RUN=true RUN_ONCE=true PORT=8793 "$NODE" --env-file=/etc/peridot-keeper/upkeep.env src/upkeep-main.mjs 2>&1 | cut -c1-600
```

Expected: `group discovery complete` with `"groups":[1,2,3]`, `"skipped":[]`, `"deferred":[]`, `interestJobs` 4, `boostedJobs` 2, `feeBudget.sufficient: true` with `requiredWithHeadroomStroops` near 77,000,000; then six `[dry-run] ... simulated` lines and `upkeep cycle complete ... "failed":false`. Exit status 0. Stop here and do not continue if any group is listed under `skipped` or `deferred`, or if it exits non-zero.

## Step 4: install the unit (derived from the existing one)

```sh
UNIT=$(sudo systemctl show -p FragmentPath peridot-keeper-group1 --value); echo "$UNIT"
sudo sed -e 's#/opt/peridot-markets/#/opt/peridot-markets-upkeep/#g' -e 's#group-main\.mjs#upkeep-main.mjs#g' \
  -e 's#group1\.env#upkeep.env#g' -e 's#^Description=.*#Description=Peridot keeper, all groups upkeep#' "$UNIT" \
  | sudo tee /etc/systemd/system/peridot-keeper-upkeep.service >/dev/null
# Read it before going on: it must point at /opt/peridot-markets-upkeep, upkeep-main.mjs and upkeep.env, and nothing else changed.
diff "$UNIT" /etc/systemd/system/peridot-keeper-upkeep.service
sudo systemd-analyze verify /etc/systemd/system/peridot-keeper-upkeep.service
sudo systemctl daemon-reload
```

## Step 5: cut over (one signing key, one service)

The old service and the new one use the same signing account and the same database advisory lock, so they cannot run together. Stop the old one only between transactions (a SIGTERM mid-send leaves an unresolved INTENT row and the keeper then refuses to run).

```sh
# 1. The three group-1 transactions fire back to back about every 2 minutes. Wait for "group cycle complete" (all done, roughly
#    100 seconds of quiet follow), then stop at once.
sudo journalctl -u peridot-keeper-group1 -f -o cat | cut -c1-160        # Ctrl-C right after "group cycle complete"
sudo systemctl stop peridot-keeper-group1 && sleep 5 && systemctl is-active peridot-keeper-group1    # expect: inactive
# 2. Confirm the journal has no unresolved intent (prints a table and "OK: no unresolved intents.").
cd /opt/peridot-markets-upkeep/keeper/liquidator/margin && sudo "$NODE" --env-file=/etc/peridot-keeper/upkeep.env src/journal-status.mjs
# 3. Hand over. Disable the old unit so a reboot cannot start both.
sudo systemctl disable peridot-keeper-group1
sudo systemctl enable --now peridot-keeper-upkeep
sleep 60; sudo journalctl -u peridot-keeper-upkeep -n 40 -o cat | cut -c1-220
```

If step 2 reports an unresolved intent, do NOT start the new service. Follow the operator note in [COORDINATION.md](COORDINATION.md): confirm the hash is expired and absent on chain, then resolve the row, and only then continue.

## Step 6: verify

```sh
curl -s http://127.0.0.1:8788/health        # {"healthy":true,"mode":"live"} after the first full cycle
curl -s http://127.0.0.1:8788/status | head -c 1800
sudo journalctl -u peridot-keeper-upkeep --since "10 min ago" -o cat | grep -c confirmed     # expect about 10-12 in 10 min once settled
sudo journalctl -u peridot-keeper-upkeep --since "10 min ago" -p warning -o cat | cut -c1-200   # expect nothing
```

In `/status` expect `groups.active` to list groups 1, 2, 3, `groups.skipped` and `groups.deferred` empty, `feeBudget.sufficient: true`, and each of the 6 jobs under `interest` and `refresh` with `failures: 0`. The first minute sends 6 transactions (2 boosted, 4 interest). After it, group 3 borrows should stop failing on a stale cache.

Spend check after a few hours (Horizon, no secrets): `curl -s "https://horizon.stellar.org/accounts/GAFJVD3TKIEMIUEBJPQVZNRCG7PF25XOX7QZDRGR7Y3MNQWYQR6C2S3W" | jq -r '.balances[]|select(.asset_type=="native").balance'` should fall by about 0.1 XLM per hour.

## Rollback

The old install `/opt/peridot-markets` and its unit are untouched.

```sh
sudo systemctl stop peridot-keeper-upkeep            # right after the last job of a cycle (watch the journal for `upkeep cycle complete`)
sudo systemctl disable peridot-keeper-upkeep
sudo systemctl enable --now peridot-keeper-group1
```

Note the old `group-main` code at `bcb7f83` reads `deployments/mainnet.json` from `/opt/peridot-markets`; do not `git pull` that checkout to a newer `main` while it is the live service. (The new code accepts the legacy router, the old code does not.)

## Behaviour you may see

- `group removed from upkeep after failed re-attestation`: a group's lending controller, router or a market changed to code that is not pinned. Its jobs stop, the rest continue. Update `deployments/mainnet.json` pins (a new manifest ships through a new commit), do not loosen checks.
- A new group appears under `groups.skipped` with a reason: its router or controller is not one of the pinned builds. Add the hash to the manifest allowed list only after reviewing it.
- `unattestedBoosted` lists a vault the manifest does not know. The market still gets interest, but its boosted cache is not refreshed. To refresh it, add the vault address to the manifest (`external.defindex_vaults`) in a new commit or set `UPKEEP_EXTRA_BOOSTED_VAULTS` in `upkeep.env` after review.
- `/health` is 503 when any job is older than twice its interval, a job is failing, discovery is more than 15 minutes old, no group is covered, or signing stopped. Unlike `group-main`, it does not depend on lending repay caps.
- Not covered here (no permissionless path or no runner): reward-distributor `fund`, Aquarius `rebalance`/`harvest`, XOXNO and Zenex harvest, and the factory's admin-only `rebalance_idle_cash`.
