/**
 * Description residue cleanup (roadmap D33).
 *
 * Admin descriptions contain leftover editor headers like
 * "ITEM SPECIFICS UPDATED AND FINAL" that leak into schema descriptions and
 * the Merchant feed. This script finds ALL-CAPS short lines (no colon, not a
 * real heading like KEY FEATURES/CONDITION) and — with --apply — removes them.
 * Never touches any line with real content.
 *
 * Dry run (default): prints every candidate line per product.
 * Apply:  cd backend && npx tsx scripts/clean-description-residue.ts --apply
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')

/** Lines that are real section headers — keep them (the parser uses them). */
const KEEP_HEADERS = /^(key features?|item specifics?|condition|included|excluded|what'?s included|shipping|warranty|notes?|packaging|compatib|specifications|features)\b/i

/** A residue candidate: ALL CAPS, short, no colon, not a kept header. */
function isResidue(line: string): boolean {
  const s = line.trim()
  if (!s) return false
  if (s.includes(':')) return false // "LABEL: value" pairs are data
  if (KEEP_HEADERS.test(s)) return false
  if (s.length > 60) return false
  return s === s.toUpperCase() && /[A-Z]/.test(s) && !/[.!?]/.test(s)
}

async function main() {
  const products = await prisma.product.findMany({
    select: { id: true, name: true, description: true },
  })

  console.log(`\n🧹 Description residue cleanup ${APPLY ? '(APPLY — writing)' : '(dry run — pass --apply to write)'}\n`)

  let touched = 0
  for (const p of products) {
    if (!p.description) continue
    const lines = p.description.split(/\r?\n/)
    const residue = lines.filter(isResidue)
    if (residue.length === 0) continue

    touched++
    console.log(`• ${p.name} (${p.id})`)
    for (const r of residue) console.log(`    remove: "${r.trim()}"`)

    if (!APPLY) continue
    const cleaned = lines.filter((l) => !isResidue(l)).join('\n').replace(/\n{3,}/g, '\n\n').trim()
    await prisma.product.update({ where: { id: p.id }, data: { description: cleaned } })
  }

  console.log(`\n${APPLY ? `✅ Cleaned ${touched} product(s).` : `Found residue in ${touched} product(s) — re-run with --apply to clean.`}`)
}

main()
  .catch((err) => {
    console.error('Cleanup failed:', err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
