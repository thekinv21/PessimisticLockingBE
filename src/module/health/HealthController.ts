import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';

import { Endpoint, SkipRateLimit } from '@/shared/decorators';
import { PrismaService } from '@/shared/prisma';

type THealth = { status: 'ok'; database: 'up' };

@Controller('/health')
@SkipRateLimit()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Endpoint({
    summary: 'Health check',
    description: 'Returns 200 when the database answers, 503 otherwise.',
  })
  async check(): Promise<THealth> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('Database is unavailable');
    }

    return { status: 'ok', database: 'up' };
  }
}
