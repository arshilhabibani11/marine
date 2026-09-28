/* Start the product-detail request BEFORE the app bundle has even parsed.
 *
 * The old sequence on a product deep link was:
 *   HTML -> download/parse JS -> hydrate -> React Query fetch -> <img>
 * so the API round trip (~1.2s in production) only started ~2s in.
 * This script runs straight from the HTML, overlaps the API call with the
 * JS download, and hands the result to useProductDetail via
 * window.__EARLY_PRODUCT__ (one-shot, so it never serves stale data).
 */
;(function () {
  // Only against the real site — local dev has no api.alkatraders.co CORS rule
  // for this origin and would just fire a failing request.
  if (!/(^|\.)alkatraders\.co$/.test(location.hostname)) return

  var match = location.pathname.match(
    /\/product\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/
  )
  if (!match) return

  var id = match[1]
  fetch('https://api.alkatraders.co/api/v1/storefront/products/' + id, { credentials: 'omit' })
    .then(function (res) { return res.ok ? res.json() : null })
    .then(function (data) {
      if (data && data.product) window.__EARLY_PRODUCT__ = { id: id, data: data }
    })
    .catch(function () { /* the app's own query will simply fetch it */ })
})()
