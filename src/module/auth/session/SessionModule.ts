import { Module } from '@nestjs/common';

import { JwtTokenModule } from '../jwt';
import { SessionService } from './SessionService';

/**
 * Everything the `@Auth()` guards need. Import it in every module whose
 * controllers or gateways authenticate requests.
 */

@Module({
  imports: [JwtTokenModule],
  providers: [SessionService],
  exports: [JwtTokenModule, SessionService],
})
export class SessionModule {}
