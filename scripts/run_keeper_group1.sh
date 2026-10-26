#!/usr/bin/env bash
# Run the group 1 liquidator/keeper from this machine against the DigitalOcean journal database.
#   scripts/run_keeper_group1.sh dry     one dry-run cycle (no signing, safe)
#   scripts/run_keeper_group1.sh live    continuous live mode in the background (signs with peridot-mainnet-keeper)
#   scripts/run_keeper_group1.sh status  show the last log lines and the status endpoint
#   scripts/run_keeper_group1.sh stop    stop the live process
# Private config lives OUTSIDE the repo in ~/.peridot-keeper (group1.env 600, ca.pem, keeper.log). Never commit it.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
DIR=$HOME/.peridot-keeper
KEEPER=$ROOT/keeper/liquidator/margin
case "${1:-}" in
  dry)  cd "$KEEPER" && node --env-file="$DIR/group1.env" src/group-main.mjs 2>&1 | tail -15 | cut -c1-240 ;;
  live)
    sed -e 's/^DRY_RUN=true/DRY_RUN=false/' -e 's/^RUN_ONCE=true/RUN_ONCE=false/' "$DIR/group1.env" > "$DIR/group1-live.env"; chmod 600 "$DIR/group1-live.env"
    cd "$KEEPER"
    nohup caffeinate -i node --env-file="$DIR/group1-live.env" src/group-main.mjs >> "$DIR/keeper.log" 2>&1 &
    echo $! > "$DIR/keeper.pid"; echo "started pid $(cat "$DIR/keeper.pid")"; sleep 20; tail -n 6 "$DIR/keeper.log" | cut -c1-230 ;;
  status) tail -n 8 "$DIR/keeper.log" | cut -c1-230; curl -s http://127.0.0.1:8788/status | head -c 700; echo ;;
  stop) kill "$(cat "$DIR/keeper.pid")" && echo stopped ;;
  *) sed -n 2,7p "$0"; exit 1 ;;
esac
