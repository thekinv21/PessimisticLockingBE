import { z } from 'zod';

import { LockResource } from '@/shared/constants';

export const LockWatchSchema = z.strictObject({
  resource: z.enum(LockResource),
});

export const LockTargetSchema = z.strictObject({
  resource: z.enum(LockResource),
  id: z.string().trim().min(1).max(64),
});
