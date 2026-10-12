import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { RoleRefsSchema } from './CreateUserDto';

const UpdateUserSchema = z.strictObject({
  id: z.cuid2(),
  fullName: z.string().trim().min(1).max(100).optional(),
  email: z.email().trim().toLowerCase().optional(),
  avatar: z.string().max(2048).nullable().optional(),
  isActive: z.boolean().optional(),
  roles: RoleRefsSchema.optional(),
});

export class UpdateUserDto extends createZodDto(UpdateUserSchema) {}
