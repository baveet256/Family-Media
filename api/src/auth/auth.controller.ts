import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { SendOtpDto, VerifyOtpDto } from './dto/otp.dto';

@Controller('auth/otp')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Unauthenticated and SMS-backed, so these are the most abuse-prone routes
  // in the API. Per-phone cooldown and attempt caps live in AuthService; these
  // limits cap a single client regardless of which phone it targets.
  @Throttle({ default: { limit: 5, ttl: 300_000 } })
  @Post('send')
  send(@Body() dto: SendOtpDto) {
    return this.auth.sendOtp(dto);
  }

  @Throttle({ default: { limit: 10, ttl: 300_000 } })
  @Post('verify')
  verify(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto);
  }
}
