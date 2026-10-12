import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { JwtTokenService } from './JwtTokenService';

@Module({
  imports: [JwtModule.register({})],
  providers: [JwtTokenService],
  exports: [JwtTokenService],
})
export class JwtTokenModule {}
