import { Module } from '@nestjs/common';

import { SessionModule } from '@/module/auth/session';

import { LockGateway } from './LockGateway';
import { LockService } from './LockService';

@Module({
  imports: [SessionModule],
  providers: [LockGateway, LockService],
  exports: [LockService],
})
export class LockModule {}
