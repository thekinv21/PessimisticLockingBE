import { Global, Module } from '@nestjs/common';

import { LockGateway } from './LockGateway';
import { LockService } from './LockService';

@Global()
@Module({
  providers: [LockGateway, LockService],
  exports: [LockService],
})
export class LockModule {}
