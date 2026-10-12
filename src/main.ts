import { ConsoleLogger, Logger, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';

import helmet from 'helmet';
import { cleanupOpenApiDoc } from 'nestjs-zod';

import { createSwaggerConfig, env, TEnv } from '@/config';
import { AppModule } from '@/module/AppModule';

async function bootstrap() {
  /**
   * JSON lines in production so log collectors can parse them; colored
   * text in development.
   */

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new ConsoleLogger({ json: env.NODE_ENV === 'production' }),
  });

  app.disable('x-powered-by');

  app.use(helmet());

  const configService = app.get<ConfigService<TEnv, true>>(ConfigService);

  const port = configService.get('PORT', { infer: true });

  const isProduction: boolean =
    configService.get('NODE_ENV', { infer: true }) === 'production';

  const trustProxy = configService.get('TRUST_PROXY', { infer: true });

  if (trustProxy > 0) app.set('trust proxy', trustProxy);

  app.enableCors({
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    origin: configService.get('CORS_ORIGINS', { infer: true }),
  });

  app.setGlobalPrefix('/api');

  app.enableVersioning({
    type: VersioningType.URI,
  });

  app.enableShutdownHooks();

  if (!isProduction) {
    SwaggerModule.setup(
      '/docs',
      app,
      cleanupOpenApiDoc(
        SwaggerModule.createDocument(app, createSwaggerConfig(port)),
      ),
      { swaggerOptions: { persistAuthorization: true } },
    );
  }

  await app.listen(port);

  if (!isProduction) {
    Logger.debug(`Swagger UI running on host: http://localhost:${port}/docs`);
  }
}
bootstrap().catch((error: unknown) => {
  Logger.error(error, 'Bootstrap');
  process.exit(1);
});
