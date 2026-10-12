import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { SEED_OWNER_EMAIL, SEED_PASSWORD } from '@/shared/constants';

import { env } from '@/config';

/**
 * Prefills the Swagger login form with the seeded OWNER outside production.
 */

const isProduction = env.NODE_ENV === 'production';

const LoginSchema = z.strictObject({
  email: z
    .email()
    .trim()
    .toLowerCase()
    .meta(isProduction ? {} : { example: SEED_OWNER_EMAIL }),
  password: z
    .string()
    .min(1)
    .meta(isProduction ? {} : { example: SEED_PASSWORD }),
});

export class LoginDto extends createZodDto(LoginSchema) {}
