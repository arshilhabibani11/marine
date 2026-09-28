/* One-shot: give products with no categoryId a category, so storefront
 * category browsing/filters (which count by categoryId) stop showing 0.
 *
 * Dry-run by default — it only prints what would change. Set APPLY=1 to write.
 * Run inside the Railway api container:
 *   APPLY=1 node /dev/stdin < assign-missing-category.js
 *
 * Optional env:
 *   FALLBACK_CATEGORY — slug or exact name of the category to use.
 *                       REQUIRED: the script refuses to guess one for you.
 */
const { PrismaClient } = require('@prisma/client')

async function main() {
  const prisma = new PrismaClient()

  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } })
  if (categories.length === 0) {
    console.error('ERR no categories exist — create one in Admin → Categories first')
    process.exit(1)
  }

  const wanted = process.env.FALLBACK_CATEGORY
  if (!wanted) {
    console.error('ERR FALLBACK_CATEGORY is not set — refusing to guess a category.')
    console.error('Available categories:')
    categories.forEach((c) => console.error(`  - ${c.name} (${c.slug})`))
    console.error('Re-run: FALLBACK_CATEGORY=<slug> [APPLY=1] node /dev/stdin < assign-missing-category.js')
    process.exit(1)
  }
  const target = categories.find((c) => c.slug === wanted || c.name === wanted)
  if (!target) {
    console.error(
      `ERR FALLBACK_CATEGORY "${wanted}" not found. Available: ` +
        categories.map((c) => `${c.name} (${c.slug})`).join(', ')
    )
    process.exit(1)
  }

  const orphans = await prisma.product.findMany({
    where: { categoryId: null },
    select: { id: true, name: true, sku: true, status: true },
    orderBy: { name: 'asc' },
  })

  if (orphans.length === 0) {
    console.log('RESULT: every product already has a category; nothing to do')
    await prisma.$disconnect()
    return
  }

  console.log(`Target category: ${target.name} (${target.slug})`)
  orphans.forEach((p) => console.log(`  - [${p.status}] ${p.sku} — ${p.name}`))

  if (process.env.APPLY !== '1') {
    console.log(`RESULT: dry run — ${orphans.length} product(s) would be assigned. Re-run with APPLY=1 to apply.`)
    await prisma.$disconnect()
    return
  }

  const res = await prisma.product.updateMany({
    where: { categoryId: null },
    data: { categoryId: target.id },
  })
  console.log(`RESULT: ${res.count} product(s) assigned to "${target.name}"`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
