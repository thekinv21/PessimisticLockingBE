import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';

import { DEFAULT_THROTTLER } from '@/shared/constants';
import { PrismaModule } from '@/shared/prisma/PrismaModule';

import { validateEnv } from '@/config';

import { AuthModule } from './auth/AuthModule';
import { PostModule } from './post/PostModule';
import { RoleModule } from './role/RoleModule';
import { UserModule } from './user/UserModule';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot({
      throttlers: [DEFAULT_THROTTLER],
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    RoleModule,
    PostModule,
  ],
  controllers: [],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
  ],
})
export class AppModule {}
