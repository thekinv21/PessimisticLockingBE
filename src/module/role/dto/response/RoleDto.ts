import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { IsoDateSchema } from '@/shared/schemas';

const RoleSchema = z.object({
  id: z.cuid2(),
  name: z.string(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: IsoDateSchema.optional(),
  updatedAt: IsoDateSchema.optional(),
});

export class RoleDto extends createZodDto(RoleSchema, { codec: true }) {}
