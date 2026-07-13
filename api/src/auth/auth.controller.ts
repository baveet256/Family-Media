import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { SendOtpDto, VerifyOtpDto } from './dto/auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthUser } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('otp/send')
  sendOtp(@Body() body: SendOtpDto) {
    return this.authService.sendOtp(body.phone);
  }

  @Post('otp/verify')
  verifyOtp(@Body() body: VerifyOtpDto) {
    return this.authService.verifyOtp(body.phone, body.code, body.displayName);
  }

  /** Smoke-test endpoint for Step 2 — full /users/me comes in Step 3 */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return { user };
  }
}
