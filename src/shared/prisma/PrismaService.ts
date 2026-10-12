import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaPg } from '@prisma/adapter-pg';

import type { TEnv } from '@/config';
import { PrismaClient } from '@/prisma/generated/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(configService: ConfigService<TEnv, true>) {
    super({
      adapter: new PrismaPg({
        connectionString: configService.get('DATABASE_URL', { infer: true }),
      }),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
