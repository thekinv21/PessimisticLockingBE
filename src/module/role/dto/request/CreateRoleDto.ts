import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { Role } from '@/shared/constants';

const CreateRoleSchema = z.strictObject({
  name: z.enum(Role),
  description: z.string().max(255),
  isActive: z.boolean().optional(),
});

export class CreateRoleDto extends createZodDto(CreateRoleSchema) {}
