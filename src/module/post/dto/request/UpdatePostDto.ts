import { createZodDto } from 'nestjs-zod';

import { CreatePostSchema } from './CreatePostDto';

const UpdatePostSchema = CreatePostSchema.extend({
  description: CreatePostSchema.shape.description
    .unwrap()
    .nullable()
    .optional(),
}).partial({ title: true });

export class UpdatePostDto extends createZodDto(UpdatePostSchema) {}
