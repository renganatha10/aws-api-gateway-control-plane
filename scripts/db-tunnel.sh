#!/usr/bin/env bash
set -euo pipefail

INSTANCE_ID="i-089e5c89e76cfa398"
RDS_HOST="api-portal-prod-database-dbinstance-spw5n5gly5ow.cvyaikccmj3j.ap-south-1.rds.amazonaws.com"
RDS_PORT="5432"
LOCAL_PORT="5433"

echo "Starting SSM port-forward: localhost:${LOCAL_PORT} → RDS:${RDS_PORT}"
echo "Press Ctrl+C to stop the tunnel."
echo ""

aws ssm start-session \
  --target "${INSTANCE_ID}" \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters "{\"host\":[\"${RDS_HOST}\"],\"portNumber\":[\"${RDS_PORT}\"],\"localPortNumber\":[\"${LOCAL_PORT}\"]}"
