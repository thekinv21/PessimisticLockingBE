import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { AvatarSchema, RoleRefsSchema } from './CreateUserDto';

const UpdateUserSchema = z.strictObject({
  fullName: z.string().trim().min(1).max(100).optional(),
  email: z.email().trim().toLowerCase().optional(),
  avatar: AvatarSchema.nullable().optional(),
  isActive: z.boolean().optional(),
  roles: RoleRefsSchema.optional(),
});

export class UpdateUserDto extends createZodDto(UpdateUserSchema) {}
