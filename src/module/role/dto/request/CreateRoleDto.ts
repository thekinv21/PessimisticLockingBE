import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Role names are stored upper-case. Roles without a RoleRank entry rank as
 * USER, so a new role grants no management rights by itself.
 */

export const RoleNameSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z][A-Z0-9_]{1,49}$/, 'Use 2-50 letters, digits or underscores');

const CreateRoleSchema = z.strictObject({
  name: RoleNameSchema,
  description: z.string().max(255),
  isActive: z.boolean().optional(),
});

export class CreateRoleDto extends createZodDto(CreateRoleSchema) {}
