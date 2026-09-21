# Resident worker foundation

This directory contains deployment templates for long-running or scheduled work on the ConoHa AI WORK FACTORY.

## Operating rules

- Health monitoring is installed before resident workers.
- Existing project repositories stay in place under `/opt/norizo`; do not move them merely to satisfy a new directory convention.
- Each worker must be idempotent or checkpointed so it can resume safely after interruption.
- Collection concurrency stays deliberately low. Respect source-site terms, robots directives, access limits and backoff.
- API, RSS, sitemap, JSON-LD and other structured sources are preferred before browser automation.
- HTTP 403, CAPTCHA or suspicious blocking must stop that lane for review. The systemd template reserves exit code `75` for this condition and prevents restart loops.
- Secrets are read from root-controlled environment files outside GitHub. Never commit credentials.
- No worker may open a new public port as part of deployment.
- Production websites are outside the worker deployment path. Vercel remains local/ConoHa QA -> Preview only when requested -> NORIZO confirmation -> Production.

## Initial OMNW lanes

1. Discovery
2. Recognition
3. Master normalization / deduplication
4. M0 -> M5
5. Official-source verification
6. Label variant handling
7. CWS Master synchronization
8. CNW / CWS differential detection
9. Scheduled ETL

Do not enable a lane until its repository entrypoint, environment requirements, write targets, retry behavior and checkpoint semantics have been audited.

## Template deployment

`omnw-worker@.service.template` is intentionally not directly installable because the worker executable is project-specific. The implementation agent must replace `<EXECUTABLE>` only after inspecting the actual OMNW repository and proving a one-shot local run is safe.

The health endpoint is loopback-only at `127.0.0.1:8787`; resident workers should not depend on any externally exposed monitoring port.
