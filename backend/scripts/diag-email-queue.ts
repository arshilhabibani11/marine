/**
 * Email delivery diagnostic (read-only) — why is sales@ not receiving mail?
 *
 * Reads the email_queue table and reports:
 *   - status breakdown (sent / failed / retrying / pending)
 *   - recent rows with lastError so SMTP failures are visible
 *   - dry-run detection: 'sent' rows are indistinguishable from really-sent
 *     ones in the DB when SMTP env vars were missing at send time, so this
 *     also prints the current env configuration state (never the secrets).
 *
 * Run: cd backend && npx tsx scripts/diag-email-queue.ts
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function since(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

async function main() {
  console.log('═══ Email delivery diagnostic ═══\n')

  // ── Current env state (booleans only — never print secrets) ──
  const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
  console.log('SMTP configuration in this environment:')
  console.log(`  SMTP_HOST: ${process.env.SMTP_HOST ? 'set' : '❌ MISSING'}`)
  console.log(`  SMTP_USER: ${process.env.SMTP_USER ? 'set' : '❌ MISSING'}`)
  console.log(`  SMTP_PASS: ${process.env.SMTP_PASS ? 'set' : '❌ MISSING'}`)
  console.log(`  EMAIL_FROM: ${process.env.EMAIL_FROM || '(default) noreply@alkatraders.co'}`)
  console.log(`  SALES_EMAIL/COMPANY_EMAIL override: ${process.env.SALES_EMAIL || process.env.COMPANY_EMAIL || '(none — defaults to sales@alkatraders.co)'}`)
  console.log(`  → transport ${smtpConfigured ? 'READY' : 'NOT CONFIGURED — sendEmail() runs in DRY RUN: rows marked "sent" WITHOUT sending'}\n`)
  console.log('  (Note: this reads backend/.env locally. Railway env vars may differ — check the Railway dashboard.)\n')

  // ── Status breakdown, last 30 days ──
  const grouped = await prisma.emailQueue.groupBy({
    by: ['status'],
    _count: { _all: true },
    where: { createdAt: { gte: since(30) } },
  })
  console.log('Last 30 days by status:')
  if (grouped.length === 0) console.log('  (no rows — nothing was ever queued!)')
  for (const g of grouped) {
    console.log(`  ${g.status.padEnd(10)} ${g._count._all}`)
  }

  const totalAll = await prisma.emailQueue.count()
  console.log(`  (all time: ${totalAll} rows)\n`)

  // ── Recent rows with errors ──
  const recent = await prisma.emailQueue.findMany({
    where: { createdAt: { gte: since(30) } },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      toEmail: true, subject: true, template: true, status: true,
      attempts: true, lastError: true, createdAt: true, sentAt: true,
    },
  })
  console.log('Most recent 20 queued emails:')
  for (const r of recent) {
    const when = r.createdAt.toISOString().slice(0, 16).replace('T', ' ')
    const err = r.lastError ? `  ⚠ lastError: ${r.lastError.slice(0, 140)}` : ''
    console.log(`  [${when}] ${r.status.padEnd(8)} → ${r.toEmail}  "${r.subject.slice(0, 50)}" (attempts=${r.attempts})${err}`)
  }

  // ── Who was mail sent to? ──
  const toSales = await prisma.emailQueue.count({
    where: { createdAt: { gte: since(30) }, toEmail: { contains: 'sales@alkatraders.co' } },
  })
  console.log(`\nRows addressed to sales@alkatraders.co (30d): ${toSales}`)

  const failed = await prisma.emailQueue.findMany({
    where: { status: { in: ['failed', 'retrying'] } },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { toEmail: true, subject: true, lastError: true, attempts: true, createdAt: true },
  })
  if (failed.length > 0) {
    console.log('\nLatest failures/retries:')
    for (const f of failed) {
      console.log(`  [${f.createdAt.toISOString().slice(0, 16)}] ${f.toEmail} — ${f.lastError?.slice(0, 160) || 'no error recorded'} (attempts=${f.attempts})`)
    }
  }
}

main()
  .catch((e) => {
    console.error('Diagnostic failed:', e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
