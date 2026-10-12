import z from 'zod';

const positiveInt = () => z.coerce.number().int().positive();

const nonEmptyString = () => z.string().trim().nonempty();

const urlList = () =>
  z
    .string()
    .transform((value) =>
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.url()).nonempty());

export const envSchema = z
  .looseObject({
    NODE_ENV: z.enum(['development', 'production', 'test']),
    PORT: positiveInt().max(65535),
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    CORS_ORIGINS: urlList(),
    DATABASE_URL: nonEmptyString(),
    JWT_ACCESS_SECRET: nonEmptyString().min(32),
    JWT_REFRESH_SECRET: nonEmptyString().min(32),
    JWT_ACCESS_EXPIRES_IN: nonEmptyString(),
    JWT_REFRESH_EXPIRES_IN: nonEmptyString(),
  })
  .refine((env) => env.JWT_ACCESS_SECRET !== env.JWT_REFRESH_SECRET, {
    path: ['JWT_REFRESH_SECRET'],
    message: 'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ',
  });

export type TEnv = z.infer<typeof envSchema>;
