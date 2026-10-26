# Web hosting (DigitalOcean droplet)

Public droplet that serves the Peridot Markets app from `app/` of branch `demo-merge`.

| Item | Value |
|---|---|
| Droplet | `peridot-web`, id `612692946`, region `fra1`, `s-1vcpu-2gb`, Ubuntu 24.04 |
| IP | `165.22.89.201` |
| Cost | 12 USD per month (2 GB swap file added on the 50 GB disk, no extra cost) |
| DO account | doctl context `peridot2` (same account as the keeper droplets) |
| Cloud firewall | `peridot-web` (id `07074d0b-6011-41e0-967c-89afc0f1e57b`): inbound 22, 80, 443 only. It is attached by droplet id because the API token cannot create tags; the host also runs `ufw` with the same three ports |
| SSH | `ssh -i ~/.ssh/peridot-keeper-droplet root@165.22.89.201` |

## What runs

| Unit | Port (127.0.0.1) | Build |
|---|---|---|
| `peridot-web.service` | 3000 | `NEXT_PUBLIC_NETWORK=mainnet` (default network, live mainnet beta) |
| `peridot-web-testnet.service` | 3001 | `NEXT_PUBLIC_NETWORK=testnet` (launchpad demo, signing enabled) |
| `caddy.service` | 80, 443 | reverse proxy and automatic Let's Encrypt |

The network is baked into the Next.js bundle at build time (`NEXT_PUBLIC_*`), so there is one build per network, each in its own dist dir (`.next-mainnet-<ts>`, `.next-testnet-<ts>`). The mainnet build links to the testnet app through `NEXT_PUBLIC_TESTNET_APP_URL`, which `peridot-web-build` sets from the configured testnet host. Units run as the unprivileged `web` user with `NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome`, `PrivateTmp`, `PrivateDevices`, and a 700 MB memory cap, and restart on failure. Code lives in `/opt/peridot-web/app`, unit environment in `/etc/peridot-web/{mainnet,testnet}.env`, the deployed commit in `/etc/peridot-web/deployed-commit`.

## View it now (no domain needed)

- Mainnet app: http://165.22.89.201
- Testnet launchpad app: http://testnet.165.22.89.201.sslip.io (sslip.io resolves that name to the droplet IP, so Caddy can route by hostname before you own a domain)

Wallets that need HTTPS (browser extension popups, Albedo) work reliably only on the real domain below.

## What you do in Cloudflare

Pick two hostnames. Using sibling names (not a nested `testnet.app.example.com`) keeps Cloudflare's free Universal SSL certificate valid if you later proxy. Example for `peridot.xyz`: `markets.peridot.xyz` (mainnet) and `testnet-markets.peridot.xyz` (testnet).

1. Cloudflare dashboard, the zone, DNS, Records, Add record, twice:
   - Type `A`, Name `markets`, IPv4 address `165.22.89.201`, **Proxy status: DNS only (grey cloud)**, TTL Auto.
   - Type `A`, Name `testnet-markets`, IPv4 address `165.22.89.201`, **DNS only (grey cloud)**.
2. On the droplet, switch Caddy to the real names (one command; the mainnet build is rebuilt for a few minutes so its testnet link is right):

   ```
   ssh -i ~/.ssh/peridot-keeper-droplet root@165.22.89.201 'peridot-set-domain markets.peridot.xyz testnet-markets.peridot.xyz'
   ```

   With one argument the testnet host defaults to `testnet.<domain>`. Add `--no-rebuild` to skip the rebuild (Caddy changes apply immediately; only the in-app "Open the testnet app" link would keep the old address). Reset to IP-only with `peridot-set-domain --ip-only`.
3. Wait one to two minutes. Caddy obtains the Let's Encrypt certificates through the HTTP challenge, which needs the grey cloud. Check: `curl -I https://markets.peridot.xyz` and `journalctl -u caddy -n 30 --no-pager`.
4. Optional, after step 3 works: turn the proxy on (orange cloud) for both records and set SSL/TLS, Overview, encryption mode to **Full (strict)**. Do not use Flexible (it causes redirect loops). If a certificate renewal ever fails while proxied, switch the record back to DNS only for a minute.

## Redeploy a newer branch

From the repo root (any machine with the SSH key, rsync and git):

```
scripts/deploy_web_droplet.sh 165.22.89.201 origin/<branch>
```

It exports `app/` of that ref, rsyncs it, then `peridot-web-build` runs `npm ci` and builds both networks into fresh dist dirs, restarts the units and deletes the old dist dirs. Then it prints the HTTP status for `/`, `/groups/1`, `/launch-token`. Rerunning is safe. First-time setup of a fresh droplet: add `--provision` (installs node 22, npm 11, Caddy, swap, the `web` user, units and helper scripts). Build time on this size is about 4 to 8 minutes for both networks; the old build keeps serving until each new one is ready.

## Operations

- Logs: `journalctl -u peridot-web -u peridot-web-testnet -u caddy -f`
- Restart: `systemctl restart peridot-web peridot-web-testnet`
- Rebuild only one network: `peridot-web-build testnet`
- Cloudflare note: the app never receives secrets; all `NEXT_PUBLIC_*` values are public RPC endpoints.
