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

export const envSchema = z.looseObject({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: positiveInt().max(65535),
  CORS_ORIGINS: urlList(),
  DATABASE_URL: nonEmptyString(),
  JWT_ACCESS_SECRET: nonEmptyString().min(32),
  JWT_REFRESH_SECRET: nonEmptyString().min(32),
  JWT_ACCESS_EXPIRES_IN: nonEmptyString(),
  JWT_REFRESH_EXPIRES_IN: nonEmptyString(),
});

export type TEnv = z.infer<typeof envSchema>;
