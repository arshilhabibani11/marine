import { Router } from 'express'
import * as merchantFeedService from '../../services/merchantFeedService.js'

const router = Router()

// ─── GET /api/storefront/merchant-feed.xml ────────────────────
// Google Merchant Center product feed. Public (feed fetchers are not
// authenticated), but read-only and rate-limited by the storefront limiter.
router.get('/', async (_req, res) => {
  try {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=1800')
    const xml = await merchantFeedService.generateFeed()
    res.send(xml)
  } catch (err) {
    console.error('Merchant feed generation error:', err)
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Feed temporarily unavailable</title></channel></rss>')
  }
})

export default router
