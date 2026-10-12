import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const RoleRefsSchema = z
  .array(
    z.strictObject({
      id: z.cuid2(),
    }),
  )
  .min(1)
  .refine(
    (roles) => new Set(roles.map(({ id }) => id)).size === roles.length,
    'Roles must be unique',
  );

/**
 * Only http(s) URLs, so a stored avatar can never be a `javascript:` link.
 */

export const AvatarSchema = z.url({ protocol: /^https?$/ }).max(2048);

export const CreateUserSchema = z.strictObject({
  fullName: z.string().trim().min(1).max(100),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8).max(72),
  avatar: AvatarSchema.optional(),
  isActive: z.boolean().optional(),
  roles: RoleRefsSchema,
});

export class CreateUserDto extends createZodDto(CreateUserSchema) {}
