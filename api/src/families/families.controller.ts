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
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/guards/auth.guard';
import {
  CreateFamilyDto,
  InviteByPhoneDto,
  UpdateFamilyDto,
} from './dto/family.dto';
import { FamiliesService } from './families.service';

@Controller('families')
@UseGuards(AuthGuard)
export class FamiliesController {
  constructor(private readonly families: FamiliesService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateFamilyDto) {
    return this.families.create(user.userId, dto);
  }

  @Get(':id')
  getOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.families.getById(id, user.userId);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFamilyDto,
  ) {
    return this.families.update(id, user.userId, dto);
  }

  @Post(':id/invites')
  invite(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InviteByPhoneDto,
  ) {
    return this.families.inviteByPhone(id, user.userId, dto);
  }

  @Get(':id/join-requests')
  listJoinRequests(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.families.listJoinRequests(id, user.userId);
  }
}
