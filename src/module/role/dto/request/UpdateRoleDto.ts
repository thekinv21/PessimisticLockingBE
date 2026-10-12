import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * The role name is immutable: renaming a role would silently change the
 * permissions of every user it is assigned to.
 */

const UpdateRoleSchema = z.strictObject({
  id: z.cuid2(),
  description: z.string().max(255).optional(),
  isActive: z.boolean().optional(),
});

export class UpdateRoleDto extends createZodDto(UpdateRoleSchema) {}
