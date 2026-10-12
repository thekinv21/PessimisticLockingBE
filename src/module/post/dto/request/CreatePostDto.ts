import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreatePostSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
});

export class CreatePostDto extends createZodDto(CreatePostSchema) {}
