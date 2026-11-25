ASTOR ROLE PLAY — CLOUDFLARE WORKERS PACKAGE

FILES TO UPLOAD / DEPLOY
- src-worker.js       Worker backend (Discord OAuth, whitelist webhook, ticket channel creation)
- wrangler.toml       Cloudflare Worker + static assets configuration
- public/index.html   ASTOR ROLE PLAY website
- public/style.css    Blue dark theme
- public/app.js       Website form behavior
- package.json        Wrangler CLI setup

IMPORTANT
This is a Cloudflare Workers project, not a Pages static-only upload. Deploy it as a Worker with Static Assets.
The project expects these Worker secrets/variables:

Secrets (use `npx wrangler secret put NAME`):
DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET
SESSION_SECRET
DISCORD_WEBHOOK_URL
DISCORD_BOT_TOKEN

Plain variables (Cloudflare dashboard > Worker > Settings > Variables):
DISCORD_GUILD_ID
TICKET_CATEGORY_ID (optional)
STAFF_ROLE_ID (optional)

HOW TO DEPLOY WITH TERMINAL
1. Install Node.js LTS.
2. Extract this ZIP.
3. Open terminal in this folder.
4. Run: npm install
5. Run: npx wrangler login
6. Add secrets one by one:
   npx wrangler secret put DISCORD_CLIENT_ID
   npx wrangler secret put DISCORD_CLIENT_SECRET
   npx wrangler secret put SESSION_SECRET
   npx wrangler secret put DISCORD_WEBHOOK_URL
   npx wrangler secret put DISCORD_BOT_TOKEN
   Paste the value when asked; do not put secrets in public code.
7. Set DISCORD_GUILD_ID in Cloudflare Worker settings as a variable.
   Optionally set TICKET_CATEGORY_ID and STAFF_ROLE_ID.
8. Run: npm run deploy
9. Cloudflare gives you a URL such as https://astor-role-play.<your-subdomain>.workers.dev

DISCORD OAUTH CALLBACK
After deployment, if your Worker URL is https://YOUR-WORKER.workers.dev, set this exact URL in:
Discord Developer Portal > Application > OAuth2 > Redirects
https://YOUR-WORKER.workers.dev/auth/discord/callback

No BASE_URL or DISCORD_CALLBACK_URL is needed in this Workers version; it automatically uses the deployed request domain.

BOT PERMISSIONS
Invite the bot to the Discord server with Manage Channels, View Channels, Send Messages, Read Message History.
Make sure the bot role is high enough and can access the ticket category.
The bot token must be stored as a Worker secret, never in browser JavaScript.

WEBHOOK SECURITY
The previously shared webhook should be deleted/revoked. Create a new webhook and store it as DISCORD_WEBHOOK_URL secret.

NOTES
- This package uses a signed HttpOnly session cookie. For production, keep SESSION_SECRET long and private.
- Set your Discord invite URL in public/index.html at the element with id="discordLink".
- Test OAuth login, whitelist submission, and ticket creation after deployment.
