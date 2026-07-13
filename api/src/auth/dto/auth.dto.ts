import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class SendOtpDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[0-9]{8,15}$/, {
    message: 'phone must be digits, optionally starting with +',
  })
  phone!: string;
}

export class VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[0-9]{8,15}$/, {
    message: 'phone must be digits, optionally starting with +',
  })
  phone!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  code!: string;

  /** Required on first signup; ignored if user already exists */
  @IsOptional()
  @IsString()
  @MinLength(1)
  displayName?: string;
}
