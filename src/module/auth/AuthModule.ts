import { Module } from '@nestjs/common';

import { UserModule } from '../user/UserModule';
import { AuthController } from './AuthController';
import { AuthService } from './AuthService';
import { SessionModule } from './session';

@Module({
  imports: [SessionModule, UserModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
