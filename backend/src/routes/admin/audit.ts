import { Router } from 'express'
import { z } from 'zod'
import { authenticateAdmin, requireOwner } from '../../middleware/auth.js'
import { asyncHandler, validateQuery } from '../../middleware/validate.js'
import { sendSuccess } from '../../middleware/response.js'
import * as auditService from '../../services/auditService.js'

const router = Router()
router.use(authenticateAdmin)
// Audit history exposes who did what across the store — owner-only, matching
// the AdminSidebar visibility rule.
router.use(requireOwner)

const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  entityType: z.string().max(300).optional(),
  actorEmail: z.string().email().optional().or(z.literal('')),
  action: z.string().max(100).optional(),
  search: z.string().max(200).optional(),
})

// ─── List Audit Logs ───────────────────────────────────────────
router.get('/', validateQuery(auditQuerySchema), asyncHandler(async (req, res) => {
  sendSuccess(res, await auditService.listAuditLogs({
    page: Number(req.query.page),
    limit: Number(req.query.limit),
    entityType: req.query.entityType as string,
    actorEmail: req.query.actorEmail as string,
    action: req.query.action as string,
    search: req.query.search as string,
  }))
}))

export default router
