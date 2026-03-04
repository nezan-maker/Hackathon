# Operations Runbook

## Health and Metrics
- Health endpoint: `GET /health`
- Metrics endpoint: `GET /metrics`
- Request correlation: every response includes `X-Request-ID`

## Backup and Restore (MongoDB)

### Backup
1. Ensure `mongodump` is installed on the host.
2. Run:
   ```bash
   mongodump --uri "$MONGO_URI" --out /var/backups/flowbot/$(date +%F-%H%M%S)
   ```
3. Retain backups in object storage with lifecycle policy.

### Restore
1. Identify backup folder.
2. Run:
   ```bash
   mongorestore --uri "$MONGO_URI" --drop /var/backups/flowbot/<backup-folder>
   ```
3. Validate app by checking `GET /health` and key API endpoints.

## Incident Alerting
- Alert on:
  - 5xx error rate spike
  - Auth 401/403 rate anomaly
  - Process restarts / crashes
  - DB connection failures
- Minimum channels:
  - Pager for critical production incidents
  - Slack/email for warnings

## Secret Rotation
- Configure `AUTH_SECRETS` and `REFRESH_SECRETS` as comma-separated lists.
- Always place the new secret first for signing; keep previous secret(s) for validation window.
- After TTL of old tokens expires, remove old secret from the list.

## Deployment Checklist
1. `NODE_ENV=production`
2. Strong `AUTH_SECRET` / `REFRESH_SECRET` (32+ chars)
3. `CORS_ORIGINS` set to real frontend domains only
4. `ENABLE_MQTT` explicitly set
5. SMTP credentials configured (or disable email-dependent flows)
6. Run CI green before deploy
