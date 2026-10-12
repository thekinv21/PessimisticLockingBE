import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { IsoDateSchema } from '@/shared/schemas';

/**
 * createdBy / updatedBy hold user ids in the database; AuditLogInterceptor
 * replaces them with the users' full names.
 */

const PostSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  description: z.string().nullable(),
  authorId: z.string().nullable(),
  createdBy: z.string().nullable(),
  updatedBy: z.string().nullable(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
});

export class PostDto extends createZodDto(PostSchema, { codec: true }) {}
