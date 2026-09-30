# Manual Tasks — Alka Traders

Everything here **cannot be done from code** — it needs a human with account access.
Each task lists exact steps and how to verify it worked. Code-side work is tracked
separately in the agent todo list; this file only holds manual actions.

> Convention: whenever a task comes up that requires manual action (external
> dashboards, credentials, physical testing), add it to this file.

---

## 🔴 Pending now

### MT-1 · Submit Merchant Center feed (A3)

**Where:** [Google Merchant Center](https://merchants.google.com/) (needs a Google account with an MC account created for alkatraders.co)

1. Merchant Center → **Products → Feeds → Add feed** (or "+ Create feed").
2. Choose **Scheduled fetch**.
3. Fill in:
   - **Name:** `Alka Traders primary feed`
   - **Country of sale:** `United States` (add more countries later as needed)
   - **Currency:** `USD`
   - **File URL:**
     ```
     https://api.alkatraders.co/api/v1/storefront/merchant-feed.xml
     ```
   - **Frequency:** Daily (feed is cached 1h server-side, safe to fetch often)
4. Save, then click **Fetch now** to force the first fetch.

**Verify:**
- After fetch opens, check **Products → Needs attention**.
- Expect a few warnings on first pass (e.g. missing `shipping`/`tax` if the
  account requires them — set those in **Settings → Shipping** first if so).
- The feed currently ships 1+ products with real `brand`, `mpn`, `condition`,
  `price`, `availability`. IMPA codes ride in `custom_label_0`.
- **Never** expect `gtin` unless a product has a verified GS1 GTIN in the admin
  identity fields — absence of GTIN shows a "limited performance" warning, not an error.

---

### MT-2 · Submit sitemap to Search Console (A4)

**Where:** [Google Search Console](https://search.google.com/search-console) (property for `alkatraders.co` must exist — use the Domain property if DNS access is available)

1. Search Console → **Sitemaps** (under Indexing).
2. Enter: `sitemap.xml` → Submit.
   - Full URL: `https://alkatraders.co/sitemap.xml`
3. Also check **Settings → Crawl stats** later to confirm Googlebot activity.

**Verify:**
- Sitemap row shows **Success** with discovered URL count (should equal static
  routes × 3 locales + products × 3 locales — currently ~54).
- After 3–7 days: **Indexing → Pages** should start showing product URLs as
  "Indexed". Run `npm run seo:audit` locally any time to self-check health first.

---

### MT-3 · Test the accepted-offer PayPal checkout end-to-end (A5)

**Why:** API layer is verified healthy in production (validation 400s, auth 401s,
DB reachable, scheduler running), but a real payment has not been made since the
offer-payment migrations ran.

**Steps:**
1. On the live site (customer account, **not** the admin account): find or create
   a product, submit an offer via **Make Offer**.
2. In the admin panel: accept the offer (sets the accepted price + payment window).
3. Back on the storefront: **My Offers** → open the accepted offer → pay via the
   PayPal button (use a real sandbox→live PayPal account per environment).
4. Confirm:
   - Order appears in **Admin → Orders** with the negotiated price snapshot.
   - Offer status transitions: `accepted → paid`.
   - Customer sees the order in their account.
   - Stock behaviour is correct on the purchased product.
5. Also verify the **expiry sweep**: accept an offer and let the payment window
   lapse (or temporarily shorten the window in a staging DB) — offer should flip
   to expired and the product should return to available.

**Verify:** no errors in Railway `api` logs during the whole flow
(Railway dashboard → api service → Deployments → Logs).

---

## 🟡 Pending later (tie to roadmap groups)

### MT-4 · Enter product identity fields in admin (form ready: Admin → Products → edit → SEO tab → "Product Identity")

For every product where documentation is at hand, fill in:
`manufacturer`, `model number`, `MPN`, `GTIN` (only if a **verified GS1 GTIN**
exists), `IMPA code`, `source URL`, and set `last verified at`.
Products with identity filled feed better titles, richer JSON-LD, and a stronger
Merchant feed. Until then the feed falls back to description parsing — correct
but less complete.

### MT-5 · eBay developer account + credentials (before group C)

Required before any eBay integration work can hit the sandbox:
1. Register at the [eBay Developers Program](https://developer.ebay.com/).
2. Create an application → note App ID / Cert ID / Dev ID.
3. Add OAuth redirect URLs for the sandbox, then production.
4. Join/verify the Seller Hub policies for the sell account.
5. Decide notification endpoint strategy (we will expose a signed webhook route).
Provide the credentials via Railway environment variables when ready
(never in the repo).

### MT-6 · Sentry (or similar) account + DSN (E41)

Create the project(s), put the DSNs in Railway env vars (`SENTRY_DSN_FRONTEND`,
`SENTRY_DSN_BACKEND`), then wire the SDKs (code task E41).

### MT-7 · Neon backup verification (E43)

Neon dashboard → project → **Backups / PITR**: confirm point-in-time restore is
available on the current plan and do one test restore into a throwaway branch.

---

## ✅ Completed manual items

*(none yet — move items here with a date once confirmed)*

---

## Environment variables reference (Railway)

Set only in Railway dashboard → service → Variables. Never commit real secrets.

| Variable | Service | Purpose | Status |
|---|---|---|---|
| `DATABASE_URL` | api | Neon Postgres connection | ✅ set |
| `SEO_API_BASE` | web (build) | Overrides the API the build fetches products from | optional (defaults to prod API) |
| `SENTRY_DSN_*` | both | Error monitoring (MT-6) | ⬜ pending |
| eBay OAuth creds | api | eBay integration (MT-5, group C) | ⬜ pending |
