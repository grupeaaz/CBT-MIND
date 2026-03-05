# Claude Preferences for CBT-MIND

## Communication Style
- Explain code changes in plain language, as if I'm a beginner — describe *what* changed and *why* it matters
- After every edit, summarize what was added or removed in simple terms
- Avoid jargon; if a technical term is necessary, briefly define it

## Code Style
- Always use descriptive, self-explanatory variable names (e.g. `userSubscription` not `sub`, `notificationsEnabled` not `notifOn`)
- Keep changes focused — only modify what was asked, no extra refactoring or cleanup
- Prefer clarity over cleverness

## Project Notes
- This is a React + Express PWA deployed on Railway
- Device-based auth via `X-Device-Id` header (no login)
- Local storage is used for journal, mood, and wins data
- Push notifications use VAPID keys set in Railway environment variables
