import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/guards/auth.guard';
import { CreateStoryDto } from './dto/stories.dto';
import { StoriesService } from './stories.service';

@Controller()
@UseGuards(AuthGuard)
export class StoriesController {
  constructor(private readonly stories: StoriesService) {}

  @Post('stories')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateStoryDto) {
    return this.stories.create(user.userId, dto);
  }

  @Get('families/:id/stories')
  list(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.stories.listForFamily(id, user.userId);
  }

  @Post('stories/:id/view')
  view(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.stories.markViewed(id, user.userId);
  }

  @Get('stories/:id/viewers')
  viewers(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.stories.listViewers(id, user.userId);
  }
}
