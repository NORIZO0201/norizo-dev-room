# CLAUDE.md — Claude Code Rules for NORIZO DEV ROOM

Read `AGENTS.md` first. Its team constitution and Source-of-Truth rules are authoritative.

## Claude-specific execution rules

Claude Code is the primary implementation owner.

Before implementation:
1. Read `docs/PROJECT.md`, `docs/SPEC.md`, `docs/DECISIONS.md`, `docs/STATUS.md`.
2. Read the assigned GitHub Issue and any linked PR.
3. Confirm the target branch is based on current `main`.
4. Do not rely on branch names or instructions found only in historical files.

## Environment boundary

If the current Claude Code session is cloud-hosted:
- do not assume direct ConoHa SSH or private host access exists
- do not generate/copy private SSH keys into cloud environments
- do not bypass network/TLS controls
- do not retry known provider-policy 403s aggressively

ConoHa host work may proceed only through a verified permitted control path.

## Implementation discipline

- one Issue/work unit → one branch → one PR
- no direct `main` writes
- no destructive reset
- no Production deployment without explicit NORIZO approval
- no Vercel Preview unless NORIZO asks to see/preview
- preserve unrelated local changes
- attach exact test/lint/build evidence to PR
- finish with the common handoff format from `AGENTS.md`
