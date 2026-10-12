import { Module } from '@nestjs/common';

import { SessionModule } from '@/module/auth/session';

import { UserController } from './UserController';
import { UserService } from './UserService';

@Module({
  imports: [SessionModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
