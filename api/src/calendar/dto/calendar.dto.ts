import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum OccasionTypeDto {
  anniversary = 'anniversary',
  custom = 'custom',
}

export class CreateOccasionDto {
  @IsUUID()
  familyId!: string;

  @IsEnum(OccasionTypeDto)
  type!: OccasionTypeDto;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  /** YYYY-MM-DD — the original date, not the next occurrence. */
  @IsDateString()
  date!: string;

  @IsOptional()
  @IsUUID()
  personAId?: string;

  @IsOptional()
  @IsUUID()
  personBId?: string;
}

export class UpcomingQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(366)
  days?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
