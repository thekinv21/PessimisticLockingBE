import { Module } from '@nestjs/common';

import { SessionModule } from '@/module/auth/session';

import { RoleController } from './RoleController';
import { RoleService } from './RoleService';

@Module({
  imports: [SessionModule],
  controllers: [RoleController],
  providers: [RoleService],
})
export class RoleModule {}
