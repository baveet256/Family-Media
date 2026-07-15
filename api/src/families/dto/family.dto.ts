import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  displayName?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string | null;
}

export class CreateFamilyDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsBoolean()
  requireApproval?: boolean;
}

export class UpdateFamilyDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  requireApproval?: boolean;
}

export class InviteByPhoneDto {
  @IsString()
  @MinLength(8)
  phone!: string;
}

export class CreateJoinRequestDto {
  @IsString()
  @MinLength(4)
  inviteCode!: string;
}
