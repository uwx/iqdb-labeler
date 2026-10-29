#!/bin/bash
set -e

# The ingestion client backfills the firehose and needs a lot of heap while it
# catches up (jetstream's event iterator buffers without bound), hence the cap.
start_client() {
    node --max-old-space-size=6144 out/client.js &
    CLIENT_PID=$!
}

start_client
node out/server.js &
SERVER_PID=$!

# A client crash must not take the labeler API down with it (the appview 502s
# whenever the server is gone), so restart the client and keep the server up.
while true; do
    wait -n "$SERVER_PID" "$CLIENT_PID"
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
        # server died: let docker restart the whole container
        kill "$CLIENT_PID" 2>/dev/null || true
        exit 1
    fi
    echo "client exited, restarting in 5s" >&2
    sleep 5
    start_client
done
