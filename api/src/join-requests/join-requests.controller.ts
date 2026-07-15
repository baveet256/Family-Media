import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/guards/auth.guard';
import { CreateJoinRequestDto } from '../families/dto/family.dto';
import { JoinRequestsService } from './join-requests.service';

@Controller('join-requests')
@UseGuards(AuthGuard)
export class JoinRequestsController {
  constructor(private readonly joinRequests: JoinRequestsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateJoinRequestDto) {
    return this.joinRequests.create(user.userId, dto);
  }
}
