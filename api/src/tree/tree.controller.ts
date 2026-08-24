import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AuthGuard } from '../common/guards/auth.guard';
import { IsSafeUrl } from '../common/validators/is-safe-url';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/guards/auth.guard';
import { TreeService } from './tree.service';

enum RelTypeDto {
  parent_of = 'parent_of',
  spouse_of = 'spouse_of',
  sibling_of = 'sibling_of',
}

enum RelActionDto {
  create = 'create',
  delete = 'delete',
}

class CreateRelationshipChangeDto {
  @IsUUID()
  familyId!: string;

  @IsUUID()
  fromPersonId!: string;

  @IsUUID()
  toPersonId!: string;

  @IsEnum(RelTypeDto)
  type!: RelTypeDto;

  @IsEnum(RelActionDto)
  action!: RelActionDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class UpdatePersonDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @IsOptional()
  @IsSafeUrl()
  avatarUrl?: string | null;
}

@Controller()
@UseGuards(AuthGuard)
export class TreeController {
  constructor(private readonly tree: TreeService) {}

  @Get('families/:id/tree')
  getTree(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tree.getTree(id, user.userId);
  }

  @Get('families/:id/persons')
  listPersons(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tree.listPersons(id, user.userId);
  }

  @Get('persons/:id')
  getPerson(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tree.getPerson(id, user.userId);
  }

  @Patch('persons/:id')
  updatePerson(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePersonDto,
  ) {
    return this.tree.updatePerson(id, user.userId, dto);
  }

  @Post('relationship-change-requests')
  requestChange(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateRelationshipChangeDto,
  ) {
    return this.tree.requestRelationshipChange(user.userId, dto);
  }

  @Get('families/:id/relationship-change-requests')
  listRequests(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tree.listRelationshipRequests(id, user.userId);
  }

  @Post('relationship-change-requests/:id/approve')
  approve(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tree.reviewRelationshipRequest(id, user.userId, 'approve');
  }

  @Post('relationship-change-requests/:id/reject')
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tree.reviewRelationshipRequest(id, user.userId, 'reject');
  }
}
