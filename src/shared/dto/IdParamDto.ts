import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const IdParamSchema = z.object({
  id: z.cuid2(),
});

export class IdParamDto extends createZodDto(IdParamSchema) {}
