# Silver Stack Tracker — starter app

A responsive installable web app (PWA) for tracking physical silver. It works on desktop and mobile browsers.

## Included in this starter

- Dashboard with fine-silver ounces, estimated melt value, goal progress, average recorded cost per ounce, and category breakdown.
- Inventory for rounds, bars, constitutional silver, foreign coins, collectibles, and other items.
- Add, edit, and remove inventory lines; update purchase cost per item or grouped purchase.
- Live total-fine-silver preview updates when quantity or fine silver per item changes.
- Preset catalog for common U.S. constitutional coins, popular 1 oz bullion coins and rounds, fractional rounds, and common bar sizes. The 1968 25-peso coin is intentionally kept as a custom/manual entry.
- Purchase log and CSV / JSON exports.
- Live XAG/USD spot quote, refreshed every 30 seconds from Gold-API.
- Guest mode stores data in the current browser.
- Optional Supabase email accounts and private cloud sync across devices.
- PWA manifest and service worker for installation.

## Run locally

Because service workers require localhost or HTTPS, use a local web server rather than opening `index.html` directly.

```bash
python3 -m http.server 8080
```

Then visit http://localhost:8080.

## Enable public sign-ups and cloud sync

This starter uses Supabase for user accounts and per-user cloud storage.

1. Create a project at https://supabase.com.
2. Open the Supabase SQL Editor and run `supabase/schema.sql`.
3. In Supabase Authentication settings, configure your allowed site URL and redirect URLs for your eventual hosted domain. Enable email sign-ups and choose whether email confirmation is required.
4. Copy your Supabase Project URL and anon/public key into `config.js`:

```js
window.SILVER_APP_CONFIG = {
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabaseAnonKey: "YOUR_SUPABASE_ANON_PUBLIC_KEY"
};
```

5. Deploy the folder to an HTTPS static host such as Netlify, Cloudflare Pages, or Vercel.
6. Add the deployed domain to Supabase Auth's Site URL and Redirect URLs.
7. Test by creating two accounts and confirming each account sees only its own inventory.

Important: use only the Supabase anon/public key in browser code. Never put a Supabase service-role key or other secret in `config.js`.

## Live silver quote

The app requests `https://api.gold-api.com/price/XAG` and reads the silver spot quote in USD per troy ounce. Gold-API states that its live price endpoint is keyless, browser-callable, and updates about every 30 seconds. The app refreshes every 30 seconds. If the provider is unavailable, the dashboard shows an unavailable state rather than silently inventing a price.

Provider details: https://gold-api.com/docs and https://gold-api.com/faqs

Before a public launch, review the provider's current terms and attribution preferences, test uptime and response shape, and consider a paid or redundant data source if the app grows.

## Silver-weight notes

The fine-silver amount per item is intentionally editable. Presets are conveniences, not an assay or authentication tool. Verify the actual purity and weight of each item. Common U.S. 90% coin ASW approximations are used for the presets:
- Dime: 0.07234 troy oz
- Quarter: 0.18084 troy oz
- Half dollar: 0.36169 troy oz
- Morgan / Peace dollar: 0.77344 troy oz
- 1968 25-peso coin: approximately 0.5209 troy oz fine silver

## Important launch limitation

This is a working starter project, not a hosted public service yet. To make it available to everyone, you still need to create/configure the Supabase project and deploy it to a public HTTPS host. The included RLS policies isolate each signed-in user's records. Guest-mode data stays in that browser and does not automatically move to an account. Add a deliberate guest-to-account migration flow before inviting real users at scale.

## Financial disclaimer

Displayed melt value is an estimate: fine silver ounces multiplied by the latest available spot quote. It is not a dealer buyback quote, appraisal, or guaranteed sale value. Physical premiums, spreads, taxes, shipping, and collectible value are not included.

## Silver preset catalog
Presets fill the item name, category, and fine silver per item. Quantity and fine silver content remain editable, and the entry preview recalculates automatically. The total purchase cost field remains independent and editable for each inventory line or group of items. Custom / not listed entries can be entered manually.

Included presets: 90% U.S. dimes, quarters and half dollars; Morgan and Peace dollars; 40% Kennedy halves; 35% war nickels; generic .999 rounds; American Silver Eagles; Canadian Maple Leafs; Britannias; Philharmonics; 1/10, 1/4 and 1/2 oz rounds; and 1, 2, 5, 10, 1 kilo and 100 oz bars.

The 1968 Mexican 25-peso coin is deliberately not in the preset catalog. Keep it as a custom/manual entry.
