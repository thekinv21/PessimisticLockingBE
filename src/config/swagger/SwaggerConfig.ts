import { DocumentBuilder } from '@nestjs/swagger';

export const createSwaggerConfig = (port: number) =>
  new DocumentBuilder()
    .setTitle('Post Locking & Real-Time Sync API')
    .setDescription(
      'A real-time pessimistic locking and concurrency control system built with **Next.js** and **NestJS**, using **WebSockets** for live multi-tab/multi-user synchronization, read-only state enforcement, and instant update broadcasting.',
    )
    .setVersion('1.0')
    .setContact('Vadim', 'https://github.com/thekinv21', 'thekinv21@gmail.com')
    .addServer(`http://localhost:${port}`, 'Local Development')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Paste the accessToken returned by POST /auth/login',
    })
    .build();
