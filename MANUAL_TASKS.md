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

### MT-5 · eBay developer account + credentials (code is READY — waiting on these keys)

The integration code is complete (central inventory service, webhook intake,
idempotent order processing, quantity sync + reconciliation scheduler, admin
view). To activate it:

1. Register at the [eBay Developers Program](https://developer.ebay.com/).
2. Create an application → copy the **App ID (Client ID)** and **Client Secret**.
3. In Seller Hub: note your **merchant location key** and create (or note)
   fulfillment / payment / return **business policy IDs**.
4. Register the notification endpoint in the eBay Application Settings:
   `https://api.alkatraders.co/api/webhooks/ebay` — eBay sends a challenge;
   the backend answers it using `EBAY_VERIFICATION_TOKEN`.
5. Set these Railway env vars on the **api** service (never in the repo):

   | Variable | Value |
   |---|---|
   | `EBAY_ENV` | `sandbox` first, then `production` |
   | `EBAY_CLIENT_ID` | App ID |
   | `EBAY_CLIENT_SECRET` | Client Secret |
   | `EBAY_VERIFICATION_TOKEN` | any long random string (also entered on eBay) |
   | `EBAY_PUBLIC_ENDPOINT` | `https://api.alkatraders.co` |
   | `EBAY_MERCHANT_LOCATION_KEY` | from Seller Hub |
   | `EBAY_FULFILLMENT_POLICY_ID` / `EBAY_PAYMENT_POLICY_ID` / `EBAY_RETURN_POLICY_ID` | from Seller Hub |

6. Then in the admin panel → **eBay Inventory** → list a product via
   `POST /api/v1/admin/ebay/listings` (needs an eBay category id).

Everything else keeps working while these are unset — the eBay scheduler idles
and admin eBay endpoints return 503.

### MT-6 · Sentry (or similar) account + DSN (E41)

Create the project(s), put the DSNs in Railway env vars (`SENTRY_DSN_FRONTEND`,
`SENTRY_DSN_BACKEND`), then wire the SDKs (code task E41).

### MT-7 · Neon backup verification (E43)

Neon dashboard → project → **Backups / PITR**: confirm point-in-time restore is
available on the current plan and do one test restore into a throwaway branch.

### MT-8 · Search Console API access (unlocks B10 automation)

The sitemap is already auto-generated and MT-2 covers one-time submission.
Automating Search Console (impressions/clicks pull, index-coverage monitoring)
needs Google API credentials:

1. Google Cloud Console → create a project → enable the **Search Console API**.
2. Create a **service account** (or OAuth client) and add its email as a
   **property owner/delegated user** in Search Console.
3. Put the JSON key in Railway (`GSC_SERVICE_ACCOUNT_JSON`, api service).

Until then, review performance manually at search.google.com/search-console.

### MT-9 · Merchant Center Content API (unlocks automated feed push, B11)

The merchant feed route is live (`/api/feeds/merchant-center.xml`) and MT-1
covers manual submission. To have Google pull/refresh automatically or to push
via API later:

1. In Merchant Center link a Google Cloud OAuth client / service account.
2. Enable the **Content API v2** and grant it to the MC account.
3. Store credentials in Railway (`GMC_*` vars).

Cheapest path first: in MT-1, schedule the feed as a **scheduled fetch** in
Merchant Center (`https://api.alkatraders.co/api/feeds/merchant-center.xml`) —
no credentials needed.

### MT-10 · Remove leftover test products from prod DB (found by B17 audit)

`detect-duplicate-products` found test residue in the production database:
`TEST-PRODUCT-HTTP-MODE` (×2) and `TXTEST3`. They are published, have no
identity fields, and pollute the sitemap/prerender. Delete via Admin → Products
(or a Prisma script) and re-run
`npx tsx backend/scripts/detect-duplicate-products.ts` to confirm 0 published
junk rows. Real products should then get identity fields via MT-4.

### MT-11 · Write real category & buying-guide content (B13/B14)

Framework is live (category description renders on the Products page; product
pages render structured identity). What's missing is **human-approved copy** —
not AI filler. For each real category (and the top ~5 IMPA/industry queries
Alka actually wins on), write 2–4 factual paragraphs: what it is, materials,
supplier standards, and how to request a quote. Paste into the category
`description` field (admin) — the page renders it automatically.

---

## Decision records — group B (SEO architecture)

- **B9 · Slug/URL migration — deferred.** Current URLs are stable,
  prerendered, and indexed (42 URLs, trailing-slash, sitemap'd). Changing slug
  schemes forces 301 mapping + re-indexing for zero measurable gain on an
  8-item catalog. Revisit only if the real catalog grows and identity-based
  slugs (`/product/impa-232483-scupper-plug/`) become worth the migration.
- **B12 · Per-brand landing pages — deferred.** `Brands.tsx` is an honest
  showcase with live product counts; thin per-brand pages would hurt, not
  help, with 8 products. Revisit at ≥5 real brands.
- **B13/B14 · Category content & buying guides — human copy required.** See
  MT-11; the rendering framework is done and waiting on real text.
- **B15/D37 · Image alt text — done in code.** `buildImageAlt()` builds
  identity-rich alts (brand + model + IMPA) from structured fields, falling
  back to the catalog name; wired into grid, gallery, and related products.
- **B22 · Variant strategy — single pages.** No real size/variant rows exist;
  each item is its own product page (correct for IMPA-part catalogs). If
  genuine variants appear, model them as separate products sharing identity
  (brand/model/IMPA) rather than introducing a variant schema.
- **B10/B11 · Search Console & Merchant Center APIs — credential-gated.**
  See MT-8/MT-9; no code until credentials exist.

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
