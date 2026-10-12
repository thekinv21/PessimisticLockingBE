import { DocumentBuilder } from '@nestjs/swagger';

export const createSwaggerConfig = (port: number) =>
  new DocumentBuilder()
    .setTitle('WebSocket Real-Time Notifications API')
    .setDescription(
      'A real-time notification system built with **Next.js 16** and **NestJS 11**, using **WebSockets** for bidirectional real-time communication, event handling, and notification delivery.',
    )
    .setVersion('1.0')
    .setContact('Vadim', 'https://github.com/thekinv21', 'thekinv21@gmail.com')
    .addServer(`http://localhost:${port}`, 'Local Development')
    .build();
