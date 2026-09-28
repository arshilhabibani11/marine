import { Request, Response, NextFunction } from 'express'
import { ZodSchema, ZodError } from 'zod'

// ─── Validate Request Body ─────────────────────────────────────
export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body)
      next()
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        })
      }
      next(error)
    }
  }
}

// ─── Validate Query Params ─────────────────────────────────────
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Express 5 defines `req.query` as a getter-only property, and this
      // backend is ESM (strict mode), so a plain assignment throws
      // `TypeError: Cannot set property query ... which has only a getter`.
      // Define an own, writable property that shadows the prototype getter.
      const parsedQuery = schema.parse(req.query)
      Object.defineProperty(req, 'query', {
        value: parsedQuery,
        writable: true,
        enumerable: true,
        configurable: true,
      })
      next()
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Invalid query parameters',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        })
      }
      next(error)
    }
  }
}

// ─── Validate Params ───────────────────────────────────────────
export function validateParams(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = schema.parse(req.params)
      next()
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Invalid parameters',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        })
      }
      next(error)
    }
  }
}

// ─── Async Handler ─────────────────────────────────────────────
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
