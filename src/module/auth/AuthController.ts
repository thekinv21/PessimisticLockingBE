import { Body, Controller, HttpStatus, Post } from '@nestjs/common';

import { RateLimitPreset } from '@/shared/constants';
import { Endpoint, RateLimit } from '@/shared/decorators';

import { AuthService } from './AuthService';
import { Auth, CurrentUser } from './decorators';
import { LoginDto, RefreshTokenDto, RegisterDto } from './dto/request';
import { AuthDto } from './dto/response';

@Controller('/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/register')
  @RateLimit(RateLimitPreset.REGISTER)
  @Endpoint({
    summary: 'Register a new user',
    description:
      'Creates an account with the USER role. Log in afterwards to get tokens.',
    status: HttpStatus.CREATED,
  })
  async register(@Body() dto: RegisterDto): Promise<void> {
    await this.authService.register(dto);
  }

  @Post('/login')
  @RateLimit(RateLimitPreset.LOGIN)
  @Endpoint({
    summary: 'Log in',
    description: 'Returns the user and an access and refresh token pair.',
    type: AuthDto,
  })
  async login(@Body() dto: LoginDto): Promise<AuthDto> {
    return this.authService.login(dto);
  }

  @Post('/refresh-token')
  @RateLimit(RateLimitPreset.REFRESH_TOKEN)
  @Endpoint({
    summary: 'Refresh tokens',
    description: 'Swaps a valid refresh token for a new token pair.',
    type: AuthDto,
  })
  async refreshToken(@Body() dto: RefreshTokenDto): Promise<AuthDto> {
    return this.authService.refresh(dto);
  }

  @Post('/logout')
  @Auth()
  @RateLimit(RateLimitPreset.LOGOUT)
  @Endpoint({
    summary: 'Log out',
    description: 'Revokes every access and refresh token of the current user.',
  })
  async logout(@CurrentUser('sub') id: string): Promise<void> {
    await this.authService.logout(id);
  }
}
