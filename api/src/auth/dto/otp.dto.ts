import { IsOptional, IsString, Matches, MinLength } from 'class-validator';

/** Digits with optional leading +, 8–15 digits total (E.164-ish). */
export class SendOtpDto {
  @IsString()
  @Matches(/^\+?[0-9]{8,15}$/, {
    message: 'phone must be 8–15 digits, optional leading +',
  })
  phone!: string;
}

export class VerifyOtpDto {
  @IsString()
  @Matches(/^\+?[0-9]{8,15}$/)
  phone!: string;

  @IsString()
  @Matches(/^[0-9]{6}$/, { message: 'otp must be 6 digits' })
  otp!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  displayName?: string;
}
