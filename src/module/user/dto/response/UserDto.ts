import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { IsoDateSchema } from '@/shared/schemas';

export const UserSchema = z.object({
  id: z.cuid2(),
  fullName: z.string(),
  email: z.email(),
  avatar: z.string().nullable(),
  isActive: z.boolean(),
  roles: z.array(
    z.object({
      id: z.cuid2(),
      name: z.string(),
    }),
  ),
  createdAt: IsoDateSchema.optional(),
  updatedAt: IsoDateSchema.optional(),
});

export class UserDto extends createZodDto(UserSchema, { codec: true }) {}
