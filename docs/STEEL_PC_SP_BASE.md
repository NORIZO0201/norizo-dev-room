# Steel PC/SP Development Base

Updated: 2026-09-21 JST

## Decision

Use **self-hosted Steel Browser** on the existing ConoHa VPS as the default PC/SP browser-development and QA substrate.

This uses the open-source Steel Browser software and adds no Steel Cloud usage charge. The existing VPS remains the infrastructure cost.

## Official constraints checked

Current Steel self-host documentation requires:
- Docker 20.10+
- at least 4 GB RAM
- at least 10 GB free disk

Current ConoHa class (6 vCPU / 12 GB RAM / 100 GB) is sufficient.

Steel Local/self-host currently documents concurrency of 1. Therefore PC and SP QA run sequentially by default.

## Security

- Steel API: bind to 127.0.0.1:3000
- Chrome debugging/CDP: bind to 127.0.0.1:9223
- Never publish 9223 directly
- Do not expose Steel API publicly without an authenticated gateway
- Keep browser cache under /opt/norizo/steel/cache
- Do not store site passwords in GitHub

## QA profiles

### PC
- default viewport target: 1440 × 900
- desktop user agent/profile
- screenshots and interaction QA

### SP
- mobile viewport/fingerprint
- touch/mobile interaction QA
- screenshots and interaction QA

Because self-host concurrency is 1, DEV ROOM should treat PC/SP as two QA modes over one browser capacity rather than two simultaneous always-on sessions.

## Operating flow

1. Chatty defines the page and QA objective.
2. Deterministic browser QA script starts a Steel session.
3. Run PC or SP profile.
4. Capture evidence: URL, screenshot, console errors, key DOM checks.
5. Stop session.
6. Run the other profile if needed.
7. Preview is created only when NORIZO explicitly asks to see it.
8. Production only after approval and required checks.

## Cloud fallback

Steel Cloud is not the default. Current Steel Launch pricing is $0/month plus usage with one-time credits, so it is not a permanent unlimited-free replacement for self-hosting.

Use Steel Cloud only when a managed capability is specifically needed and approved.
