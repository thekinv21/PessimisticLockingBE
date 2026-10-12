import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { Role } from '@/shared/constants';

const UpdateRoleSchema = z.strictObject({
  id: z.string(),
  name: z.enum(Role),
  description: z.string().max(255).optional(),
  isActive: z.boolean().optional(),
});

export class UpdateRoleDto extends createZodDto(UpdateRoleSchema) {}
