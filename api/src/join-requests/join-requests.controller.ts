import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/guards/auth.guard';
import { CreateJoinRequestDto } from '../families/dto/family.dto';
import { SubmitOnboardingDto } from './dto/onboarding.dto';
import { JoinRequestsService } from './join-requests.service';

@Controller('join-requests')
@UseGuards(AuthGuard)
export class JoinRequestsController {
  constructor(private readonly joinRequests: JoinRequestsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateJoinRequestDto) {
    return this.joinRequests.create(user.userId, dto);
  }

  @Post(':id/onboarding')
  submitOnboarding(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitOnboardingDto,
  ) {
    return this.joinRequests.submitOnboarding(id, user.userId, dto);
  }

  @Post(':id/approve')
  approve(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.joinRequests.approve(id, user.userId);
  }

  @Post(':id/reject')
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.joinRequests.reject(id, user.userId);
  }
}
