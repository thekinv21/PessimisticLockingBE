import { createZodDto } from 'nestjs-zod';

import { CreateUserSchema } from '@/module/user/dto/request';

const RegisterSchema = CreateUserSchema.pick({
  fullName: true,
  email: true,
  password: true,
});

export class RegisterDto extends createZodDto(RegisterSchema) {}
