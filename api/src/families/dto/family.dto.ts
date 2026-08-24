import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  IsPhoneNumber,
  IsSafeUrl,
} from '../../common/validators/is-safe-url';

const NAME_MAX = 80;

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(NAME_MAX)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(NAME_MAX)
  lastName?: string;

  /** @deprecated prefer firstName/lastName — still accepted for back-compat */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(NAME_MAX * 2)
  displayName?: string;

  @IsOptional()
  @IsSafeUrl()
  avatarUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  status?: string;
}

export class CreateFamilyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(NAME_MAX)
  name!: string;

  @IsOptional()
  @IsSafeUrl()
  avatarUrl?: string;

  @IsOptional()
  @IsBoolean()
  requireApproval?: boolean;
}

export class UpdateFamilyDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(NAME_MAX)
  name?: string;

  @IsOptional()
  @IsSafeUrl()
  avatarUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  requireApproval?: boolean;
}

export class InviteByPhoneDto {
  @IsPhoneNumber()
  phone!: string;
}

export class CreateJoinRequestDto {
  @IsString()
  @MinLength(4)
  @MaxLength(32)
  inviteCode!: string;
}
