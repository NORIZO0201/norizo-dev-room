# Work PR webhook smoke test

This documentation-only change tests the GitHub pull_request event to ChatGPT Work QA path.

Acceptance criteria:
- The PR creation event starts the DEV ROOM PR QA Work task automatically.
- The task reads this diff and PR body.
- The task records PASS or NG on the PR with evidence.

No application code or production configuration is changed.
