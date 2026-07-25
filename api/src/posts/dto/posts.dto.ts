import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export enum MediaTypeDto {
  image = 'image',
  video = 'video',
}

export enum PostVisibilityDto {
  family = 'family',
  connection = 'connection',
}

export class PostMediaItemDto {
  @IsEnum(MediaTypeDto)
  mediaType!: MediaTypeDto;

  @IsString()
  @MinLength(1)
  url!: string;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreatePostDto {
  @IsUUID()
  familyId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  caption?: string;

  @IsOptional()
  @IsEnum(PostVisibilityDto)
  visibility?: PostVisibilityDto;

  @IsOptional()
  @IsUUID()
  connectionId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PostMediaItemDto)
  media?: PostMediaItemDto[];
}

export class ReactPostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(16)
  emoji!: string;
}

export class CommentPostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;
}

export class UpdatePostShareDto {
  @IsEnum(PostVisibilityDto)
  visibility!: PostVisibilityDto;

  @IsOptional()
  @IsUUID()
  connectionId?: string | null;
}

export class PresignMediaDto {
  @IsEnum(MediaTypeDto)
  mediaType!: MediaTypeDto;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  filename?: string;

  @IsOptional()
  @IsString()
  contentType?: string;
}
