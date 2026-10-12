import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { ZodSerializerInterceptor } from 'nestjs-zod';

import { DEFAULT_THROTTLER } from '@/shared/constants';
import { GlobalExceptionsFilter } from '@/shared/filters';
import {
  ApiResponseInterceptor,
  AuditLogInterceptor,
} from '@/shared/interceptors';
import { GlobalValidationPipe } from '@/shared/pipes';
import { PrismaModule } from '@/shared/prisma/PrismaModule';

import { validateEnv } from '@/config';

import { AuthModule } from './auth/AuthModule';
import { LockModule } from './lock/LockModule';
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
    LockModule,
    AuthModule,
    UserModule,
    RoleModule,
    PostModule,
  ],
  controllers: [],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ApiResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
    { provide: APP_PIPE, useClass: GlobalValidationPipe },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
