/**
 * Race-condition proof for the central inventory guard (roadmap C32).
 *
 * Two concurrent transactions both try to claim the last unit through the
 * exact atomic conditional UPDATE used by centralInventory.decreaseStock().
 * Each transaction COMMITS (a claim that rolls back releases its lock, which
 * is not how a real sale behaves) — buyer A holds the row lock briefly to
 * force genuine overlap. Postgres row locking must let exactly ONE succeed.
 * Stock is restored to its original value afterwards.
 *
 * Run: cd backend && npx tsx scripts/test-inventory-race.ts [--id=<productId>]
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const idArg = process.argv.find((a) => a.startsWith('--id='))

/** Claim one unit, optionally holding the row lock before committing. */
async function claimOnce(productId: string, holdMs: number): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const affected = await tx.$executeRawUnsafe(
      'UPDATE products SET stock_count = stock_count - 1 WHERE id = $1::uuid AND stock_count >= 1',
      productId,
    )
    if (holdMs > 0) await new Promise((r) => setTimeout(r, holdMs))
    return affected
  }, { maxWait: 10_000, timeout: 20_000 })
}

async function main() {
  let borrowed = false
  let product = idArg
    ? await prisma.product.findUnique({ where: { id: idArg.split('=')[1] }, select: { id: true, name: true, stockCount: true } })
    : await prisma.product.findFirst({
        where: { status: 'published', stockCount: { gte: 1 } },
        select: { id: true, name: true, stockCount: true },
      })

  if (!product) {
    // No product currently has stock — borrow any product for the test and
    // restore its stock afterwards (the race itself rolls back, but the
    // temporary stock=1 setup is a real write that must be reverted).
    const any = await prisma.product.findFirst({ select: { id: true, name: true, stockCount: true }, orderBy: { createdAt: 'asc' } })
    if (!any) {
      console.error('No products in the database at all — nothing to test against.')
      process.exitCode = 1
      return
    }
    await prisma.product.update({ where: { id: any.id }, data: { stockCount: 1 } })
    product = { ...any, stockCount: 1 }
    borrowed = true // true original was 0 (no product had stock ≥ 1)
    console.log('(borrowing a product and temporarily setting its stock to 1 for the test)')
  }

  console.log(`\n🏁 Race test on "${product.name}" (stock ${product.stockCount}) — claims commit, stock restored afterwards\n`)

  // Two buyers hit the button at the same time. Buyer A holds the row lock
  // for 1.2s so B's UPDATE genuinely overlaps and must wait on the lock.
  const [a, b] = await Promise.all([claimOnce(product.id, 400), claimOnce(product.id, 0)])
  const winners = [a, b].filter((n) => n === 1).length

  console.log(`   transaction A affected rows: ${a}`)
  console.log(`   transaction B affected rows: ${b}`)

  const after = await prisma.product.findUnique({ where: { id: product.id }, select: { stockCount: true } })
  const expectedAfter = Math.max(0, product.stockCount - winners)
  console.log(`   stock after claims: ${after?.stockCount} (expected ${expectedAfter}: ${after?.stockCount === expectedAfter ? '✅' : '✗'})`)

  if (winners === 1 && after?.stockCount === expectedAfter) {
    console.log('\n✅ RACE GUARD PROVEN — exactly one concurrent claim wins; stock cannot double-sell or go negative.')
  } else {
    console.log(`\n✗ UNEXPECTED: winners=${winners} (must be 1)`)
    process.exitCode = 1
  }
  return { productId: product.id, originalStock: borrowed ? 0 : product.stockCount }
}

main()
  .then(({ productId, originalStock }) => {
    // The claims COMMited (that is the point) — restore the original stock.
    return prisma.product.update({ where: { id: productId }, data: { stockCount: originalStock } }).then(() =>
      console.log(`(restored stock to its original value of ${originalStock})`))
  })
  .catch((err) => { console.error('Race test failed:', err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
