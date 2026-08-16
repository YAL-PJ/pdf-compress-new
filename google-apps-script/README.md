# Apps Script backends — moved

Both scripts this directory used to hold now live in one place:

**https://github.com/YAL-PJ/apps-script-backend**

| Was here | Now | Deployment |
| --- | --- | --- |
| `feedback-backend.gs` | `src/feedback-backend.gs` | `AKfycbzgIwbly…` (shared, all 5 sites) |
| `Code.gs` | `src/telemetry.gs` | `AKfycbxk7hBb…` (this site's telemetry only) |

These remain two separate Apps Script projects writing to two different
spreadsheets. They were not merged — only relocated.

The `feedback-backend.gs` copy that used to sit here was the newest in git
(it added the `Contact` tab handler on 2026-08-16) but had **never been
deployed**, which is why the personal site's contact form was failing. The
canonical version includes that handler.

## This site's wiring

- `components/BetaFeedbackBanner.tsx` → `FEEDBACK_ENDPOINT`, posts
  `{ app: 'compresspdf', ... }` to the shared `/exec` URL.
- `lib/analytics.ts` → `SHARED_APPS_SCRIPT_URL` (shared backend) and
  `TELEMETRY_SHEET_URL` (telemetry backend).

Endpoint URLs are stable. To change backend behaviour, edit and deploy from the
canonical repo — do not paste code into the Apps Script editor by hand.
