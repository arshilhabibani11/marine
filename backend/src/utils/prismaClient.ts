// Load env before reading process.env below (see ./env.js).
import './env.js'

import { PrismaClient } from '@prisma/client'
import { withColdStartRetry } from './dbWake.js'

const DEFAULT_CONNECT_TIMEOUT = '10'
const DEFAULT_POOL_TIMEOUT = '10'

const logConfig: ('query' | 'info' | 'warn' | 'error')[] = process.env.NODE_ENV === 'development'
  ? ['query', 'error', 'warn']
  : ['error']

/**
 * Ensure the TCP connection string fails fast. Without connect_timeout a blocked
 * port hangs until the OS gives up, which can be minutes.
 */
function withConnectTimeouts(rawUrl: string): string {
  try {
    const url = new URL(rawUrl)
    if (!url.searchParams.has('connect_timeout')) {
      url.searchParams.set('connect_timeout', DEFAULT_CONNECT_TIMEOUT)
    }
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', DEFAULT_POOL_TIMEOUT)
    }
    return url.toString()
  } catch {
    return rawUrl
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Host:port only — never the user or password. Safe to log. */
function parseHost(rawUrl: string | undefined): string {
  if (!rawUrl) return 'unset'
  try {
    return new URL(rawUrl).host || 'unknown'
  } catch {
    return 'unparseable'
  }
}

function buildPrismaClient(): PrismaClient {
  const rawUrl = process.env.DATABASE_URL

  if (!rawUrl) {
    // Failing here is caught by env.ts validation at startup; this is a
    // defensive fallback so the module at least constructs.
    return new PrismaClient({ log: logConfig })
  }

  return new PrismaClient({
    log: logConfig,
    datasources: {
      db: { url: withConnectTimeouts(rawUrl) },
    },
  })
}

/** Which database host is configured, for the startup banner and error messages. */
export function describeDbDriver(): string {
  return `postgres-tcp (${parseHost(process.env.DATABASE_URL)})`
}

/** Redacted database host — safe to write to logs. */
export function getRedactedDbHost(): string {
  return parseHost(process.env.DATABASE_URL)
}

/**
 * App-wide Prisma client.
 *
 * Every query is wrapped in a cold-start retry so a brief database blip (cold
 * start, pool ramp-up, transient network reset) does not surface as a 5xx to
 * the caller. Non-retryable errors (SQL errors, unique violations, validation
 * failures) are never retried.
 */
const retryQuery = <T>(fn: () => Promise<T>): Promise<T> =>
  withColdStartRetry(fn, { attempts: 3, baseDelayMs: 800 })

export const prisma = buildPrismaClient()

export const rawPrisma = prisma
