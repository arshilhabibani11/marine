/**
 * Background scheduler for periodic admin notifications (low-stock digest and
 * weekly/monthly sales reports). Runs alongside the email queue processor in
 * the server startup path.
 *
 * A fixed setInterval is used deliberately — the project ships no cron library,
 * and each check inside `runScheduledNotifications` is deduped by a persisted
 * "last sent" timestamp, so a tick that happens while another instance is
 * running cannot double-send.
 */
import { runScheduledNotifications } from './adminNotifications.js'
import logger from '../utils/logger.js'

const log = logger.child({ context: 'notification-scheduler' })

// Checks are cheap (a few indexed queries) and each is internally deduped, so a
// 30-minute cadence is frequent enough to stay accurate without adding load.
const DEFAULT_INTERVAL_MS = 30 * 60 * 1000
// Delay the first run so it never competes with startup/migrations.
const FIRST_RUN_DELAY_MS = 60 * 1000

let interval: ReturnType<typeof setInterval> | null = null
let firstRun: ReturnType<typeof setTimeout> | null = null

export function startNotificationScheduler(intervalMs = DEFAULT_INTERVAL_MS) {
  if (interval) return

  firstRun = setTimeout(() => {
    void runScheduledNotifications().catch((err) => log.error({ err }, 'Scheduled notifications failed'))
  }, FIRST_RUN_DELAY_MS)

  interval = setInterval(() => {
    void runScheduledNotifications().catch((err) => log.error({ err }, 'Scheduled notifications failed'))
  }, intervalMs)
}

export function stopNotificationScheduler() {
  if (firstRun) { clearTimeout(firstRun); firstRun = null }
  if (interval) { clearInterval(interval); interval = null }
}
