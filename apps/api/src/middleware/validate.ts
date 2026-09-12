import type { RequestHandler } from 'express';
import type { ZodSchema } from 'zod';

type Source = 'body' | 'query' | 'params';

/**
 * Validates and (crucially) *replaces* the request segment with the parsed,
 * typed result. Downstream handlers can trust the shape of the data.
 */
export function validate(schema: ZodSchema, source: Source = 'body'): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(result.error);
      return;
    }
    req[source] = result.data;
    next();
  };
}
