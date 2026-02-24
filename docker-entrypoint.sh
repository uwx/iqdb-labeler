#!/bin/bash
set -e

node out/server.js &
SERVER_PID=$!

node out/client.js &
CLIENT_PID=$!

# Exit as soon as either process exits
wait -n $SERVER_PID $CLIENT_PID
EXIT_CODE=$?

# Clean up the remaining process
kill $SERVER_PID $CLIENT_PID 2>/dev/null || true

exit $EXIT_CODE
