import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
  ValidateIf,
} from 'class-validator';

/** Pick an existing tree person OR create a placeholder by name. */
export class PersonRefDto {
  @IsOptional()
  @IsUUID()
  personId?: string;

  @ValidateIf((o: PersonRefDto) => !o.personId)
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class SubmitOnboardingDto {
  @ValidateNested()
  @Type(() => PersonRefDto)
  parent!: PersonRefDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PersonRefDto)
  spouse?: PersonRefDto | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PersonRefDto)
  siblings?: PersonRefDto[];
}
