import z from 'zod';

import { envSchema, TEnv } from './EnvSchema';

/**
 * .env dosyasını process.env'e yükler. Dosya yoksa (değişkenler ortamdan
 * geliyorsa) atlanır; mevcut ortam değişkenlerinin üzerine yazılmaz.
 */

function loadEnvFile(): void {
  try {
    process.loadEnvFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

/**
 * ConfigModule `validate` fonksiyonu; hatalı ya da eksik değişkende uygulama açılmaz.
 */

export function validateEnv(config: Record<string, unknown>): TEnv {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    throw new Error(
      `Invalid environment variables:\n${z.prettifyError(result.error)}`,
    );
  }

  return result.data;
}

/**
 * Zod DTO şemaları sabitleri modül yüklenirken okur, bu an
 * ConfigModule.forRoot'tan öncedir. Bu yüzden .env burada yüklenip doğrulanır.
 */

loadEnvFile();

export const env = validateEnv(process.env);
