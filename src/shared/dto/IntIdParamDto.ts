import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const IntIdParamSchema = z.object({
  id: z.coerce.number().int().positive().max(2_147_483_647),
});

export class IntIdParamDto extends createZodDto(IntIdParamSchema) {}
