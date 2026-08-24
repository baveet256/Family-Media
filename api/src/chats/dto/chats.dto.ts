import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { IsSafeUrl } from '../../common/validators/is-safe-url';

export enum ChatTypeDto {
  direct = 'direct',
  group = 'group',
}

export class CreateChatDto {
  @IsUUID()
  familyId!: string;

  @IsEnum(ChatTypeDto)
  type!: ChatTypeDto;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  participantUserIds!: string[];

  @ValidateIf((o: CreateChatDto) => o.type === ChatTypeDto.group)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;
}

export class RenameChatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;
}

export class AddParticipantsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  userIds!: string[];
}

export enum ChatRoleDto {
  admin = 'admin',
  member = 'member',
}

export class SetParticipantRoleDto {
  @IsEnum(ChatRoleDto)
  role!: ChatRoleDto;
}

export class SendMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  body?: string;

  @IsOptional()
  @IsSafeUrl()
  mediaUrl?: string;
}
