/**
 * Remove leftover TEST products from the live catalog (roadmap MT-10).
 *
 * Found by B17's duplicate/identity audit: TEST-PRODUCT-HTTP-MODE (x2) and
 * TXTEST3 were left published in the production DB by earlier API smoke
 * tests. They pollute the sitemap, prerender output, and Merchant feed.
 *
 * Safety model:
 *   - exact, case-sensitive name allowlist — never a LIKE/%pattern%
 *   - DRY-RUN by default: prints what would be deleted + related-row counts
 *   - `--apply` performs the deletion in one transaction
 *   - FK rules keep history safe: OrderItem/Offer rows survive via SetNull
 *     (they snapshot name/sku), everything else cascades
 *
 * Run:  cd backend && npx tsx scripts/remove-test-products.ts
 * Then: cd backend && npx tsx scripts/remove-test-products.ts --apply
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')

/** Exact product names that are confirmed test residue. */
const TEST_NAMES = ['TEST-PRODUCT-HTTP-MODE', 'TXTEST3']

async function main() {
  const targets = await prisma.product.findMany({
    where: { name: { in: TEST_NAMES } },
    select: {
      id: true,
      name: true,
      slug: true,
      sku: true,
      status: true,
      _count: { select: { images: true, specs: true, offers: true, orderItems: true, ebayListings: true } },
    },
  })

  if (targets.length === 0) {
    console.log('No test products found — nothing to do. ✅')
    return
  }

  console.log(`Found ${targets.length} test product(s):\n`)
  for (const t of targets) {
    const c = t._count
    console.log(
      `  ${t.name}  (${t.sku}, status=${t.status})\n` +
        `    slug=${t.slug}\n` +
        `    related: images=${c.images} specs=${c.specs} offers=${c.offers} orderItems=${c.orderItems} ebayListings=${c.ebayListings}`,
    )
  }

  if (!APPLY) {
    console.log('\nDRY RUN — nothing deleted. Re-run with --apply to delete.')
    return
  }

  const ids = targets.map((t) => t.id)
  const result = await prisma.$transaction(async (tx) => {
    // Cascade/SetNull handle children; delete the rows explicitly per model
    // only where we want a precise count in the summary.
    const images = await tx.productImage.deleteMany({ where: { productId: { in: ids } } })
    const specs = await tx.productSpec.deleteMany({ where: { productId: { in: ids } } })
    const listings = await tx.ebayListing.deleteMany({ where: { productId: { in: ids } } })
    const products = await tx.product.deleteMany({ where: { id: { in: ids }, name: { in: TEST_NAMES } } })
    return { images: images.count, specs: specs.count, listings: listings.count, products: products.count }
  })

  console.log('\nDeleted:')
  console.log(`  products:      ${result.products}`)
  console.log(`  images:        ${result.images}`)
  console.log(`  specs:         ${result.specs}`)
  console.log(`  ebayListings:  ${result.listings}`)
  // Offers/orderItems/rfqItems keep their rows (SetNull) — history intact.
  console.log('\nDone. Offers and order history were preserved (product link set to NULL).')
  console.log('Next: rebuild (npm run build) to regenerate sitemap + prerendered pages.')
}

main()
  .catch((e) => {
    console.error('FAILED:', e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
