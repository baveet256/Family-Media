import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export enum GameTypeDto {
  family_awards = 'family_awards',
  caption_battle = 'caption_battle',
}

export class CreateRoundDto {
  @IsUUID()
  familyId!: string;

  @IsEnum(GameTypeDto)
  type!: GameTypeDto;

  @IsString()
  @MinLength(2)
  @MaxLength(140)
  prompt!: string;

  /** Caption battle: the photo everyone captions. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  photoUrl?: string;

  /** How long the round stays open. Default 24h, max 7 days. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24 * 7)
  durationHours?: number;
}

export class SubmitEntryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  text!: string;
}

export class VoteDto {
  @IsUUID()
  entryId!: string;
}
