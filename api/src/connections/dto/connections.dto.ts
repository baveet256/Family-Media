import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export enum FeedPolicyDto {
  unified_feed = 'unified_feed',
  separate_feeds = 'separate_feeds',
}

export enum BridgeLinkTypeDto {
  spouse = 'spouse',
  other = 'other',
}

export class CreateConnectionInviteDto {
  @IsUUID()
  fromFamilyId!: string;

  /** Invite by the other family's invite code (admin shares it). */
  @ValidateIf((o: CreateConnectionInviteDto) => !o.toFamilyId)
  @IsString()
  @MinLength(4)
  toFamilyInviteCode?: string;

  @ValidateIf((o: CreateConnectionInviteDto) => !o.toFamilyInviteCode)
  @IsUUID()
  toFamilyId?: string;

  /** When set, invite joins this existing connection (Nth family). */
  @IsOptional()
  @IsUUID()
  connectionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  proposedName?: string;

  @IsOptional()
  @IsEnum(FeedPolicyDto)
  proposedFeedPolicy?: FeedPolicyDto;

  /** Whoever in this family is marrying into the other one. */
  @IsOptional()
  @IsUUID()
  fromPersonId?: string;
}

export class RespondConnectionInviteDto {
  @IsIn(['accept', 'decline'])
  action!: 'accept' | 'decline';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsEnum(FeedPolicyDto)
  feedPolicy?: FeedPolicyDto;

  /** This family's half of the marriage; pairs with the invite's fromPerson. */
  @IsOptional()
  @IsUUID()
  toPersonId?: string;
}

export class UpdateConnectionDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsEnum(FeedPolicyDto)
  feedPolicy?: FeedPolicyDto;
}

export class CreateBridgeLinkDto {
  @IsUUID()
  personAId!: string;

  @IsUUID()
  personBId!: string;

  @IsOptional()
  @IsEnum(BridgeLinkTypeDto)
  linkType?: BridgeLinkTypeDto;
}

export class UpdateContextDto {
  @IsUUID()
  familyId!: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  connectionId?: string | null;
}
