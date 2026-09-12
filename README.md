# Panopto Custom Speed

Chrome extension (Manifest V3) that lets you watch Panopto lectures past the 2x
speed cap and turn any lecture into AI notes, Anki flashcards, transcripts or a
translation. Premium features are sold through Stripe; sign-in is Google OAuth.

## Layout

| Path | What it is |
|------|------------|
| `manifest.json`, `popup.html`/`popup.js`, `content.js`, `background.js`, `notes.html`/`notes.js`, `leaderboard.html`/`leaderboard.js`, `terms.html` | The extension itself (repo root is the unpacked extension directory). |
| `content.css`, `darktheme.js`, `vtt-utils.js`, `anki-export.js`, `katex/`, `lib/`, `tailwind-script.js` | Styles and vendored libraries used by the pages above. |
| `icon.png`, `icon16/32/48/128.png` | Extension icons (the small ones are generated from `icon.png`). |
| `cf/worker.js` | The Cloudflare Worker backend: premium checks, Stripe checkout and webhooks, leaderboard, referrals, AI notes/chat/flashcards, transcription, admin dashboards. |
| `cf/wrangler.toml` | Worker config and bindings (KV, D1, Workers AI, Secrets Store). |
| `cf/churn-schema.sql` | D1 schema for the churn/sign-in tables. |
| `STORE-LISTING.md` | Chrome Web Store listing copy and the privacy policy link. |

## Load the extension unpacked

1. Open `chrome://extensions`, enable **Developer mode**.
2. Click **Load unpacked** and pick the repo root (the folder containing `manifest.json`).
3. Open any Panopto lecture; the popup is the toolbar icon.

Requires Chrome 116 or newer (`minimum_chrome_version` in the manifest).

## Deploy the worker

```
cd cf
npx wrangler deploy
```

`wrangler` must already be logged in (`npx wrangler login`). Bindings in
`wrangler.toml` are authoritative on deploy, so a binding added in the dashboard
must also be added there.

## Secrets

No credentials live in source. The worker reads them from Worker secrets, set with
`cd cf && npx wrangler secret put <NAME>` (and listed with `npx wrangler secret list`):

| Secret | Used for |
|--------|----------|
| `STRIPE_SECRET_KEY` | Stripe API key (`sk_live_...`). |
| `STRIPE_SECRET` | Stripe webhook signing secret (`whsec_...`). |
| `CLAUDE_API_KEY` | Anthropic key for notes, chat, flashcards and translation. |
| `GEMINI_API_KEY` | Google AI key, used only for speech-to-text in `/transcribe`. |
| `FREE_PREMIUM_AUTH` | The admin token (see below). |

If a secret is missing the worker fails closed: Stripe/AI calls throw a clear
"secret not set" error, the webhook returns 500, and admin endpoints return 401.

The `STRIPE_API_KEY` and `STRIPE_WEBHOOK_SECRET` entries in `wrangler.toml` are
Secrets Store bindings of a different type and are not read by the code; leave them
alone.

## Admin pages

`FREE_PREMIUM_AUTH` is the admin token. Every admin endpoint compares against it.

- `/ai-usage?token=<FREE_PREMIUM_AUTH>` - AI spend, budgets and per-user controls.
- `/admin/churn?key=<FREE_PREMIUM_AUTH>` - sign-in funnel and churn console
  (`CHURN_ADMIN_KEY` overrides the key for this page if set).

Other maintenance endpoints (`/stripeCheck`, `/reconcileSubs`, `/setCredits`,
`/signups`, the analytics and weekly-winner routes) take the same token as
`?token=` or `?auth=`, or as an `X-PCS-Token` header.
