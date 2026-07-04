#!/bin/bash
# Corre api (server/index.js) y mcp en modo http (server/mcp.js) en el mismo
# contenedor. Si cualquiera de los dos muere, el contenedor sale para que
# la restart policy de Docker lo reinicie completo (evita quedar con solo
# la mitad de los servicios corriendo).
set -e

node --env-file=.env server/index.js &
API_PID=$!

node --env-file=.env server/mcp.js &
MCP_PID=$!

trap 'kill -TERM $API_PID $MCP_PID 2>/dev/null' TERM INT

wait -n $API_PID $MCP_PID
EXIT_CODE=$?

kill -TERM $API_PID $MCP_PID 2>/dev/null
wait $API_PID $MCP_PID 2>/dev/null

exit $EXIT_CODE
