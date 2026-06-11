import { Request, Response, NextFunction } from 'express';
import { ZodTypeAny, ZodError } from 'zod';
import { ValidationError } from '../utils/errors';

interface SchemaDefinition {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export function validate(schemas: SchemaDefinition) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params);
      }
      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query);
      }
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Build a readable validation message
        const messages = error.errors.map((err) => {
          const path = err.path.join('.');
          return path ? `"${path}": ${err.message}` : err.message;
        });
        next(new ValidationError(messages.join('; ')));
      } else {
        next(error);
      }
    }
  };
}
