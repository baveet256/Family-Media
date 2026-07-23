import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { MediaTypeDto } from '../../posts/dto/posts.dto';

export class CreateStoryDto {
  @IsUUID()
  familyId!: string;

  @IsEnum(MediaTypeDto)
  mediaType!: MediaTypeDto;

  @IsString()
  @MinLength(1)
  url!: string;

  /** Optional override; default 24h. Max 24h for Phase 4. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(24 * 60 * 60)
  expiresInSeconds?: number;
}
