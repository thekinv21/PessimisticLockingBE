import { Module } from '@nestjs/common';

import { UserService } from '../user/UserService';
import { AuthController } from './AuthController';
import { AuthService } from './AuthService';
import { JwtTokenModule } from './jwt';

@Module({
  imports: [JwtTokenModule],
  controllers: [AuthController],
  providers: [AuthService, UserService],
})
export class AuthModule {}
