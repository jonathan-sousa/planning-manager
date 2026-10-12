import { zValidator } from '@hono/zod-validator';
import type { ValidationTargets } from 'hono';
import type { z } from 'zod';
import { ValidationError } from './errors';

/** zValidator that throws a ValidationError, rendered as 400 with per-field messages. */
export const validate = <Target extends keyof ValidationTargets, Schema extends z.ZodType>(
  target: Target,
  schema: Schema
) =>
  zValidator(target, schema, (result) => {
    if (!result.success) throw new ValidationError(result.error);
  });
