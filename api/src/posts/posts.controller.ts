import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/guards/auth.guard';
import {
  CommentPostDto,
  CreatePostDto,
  ReactPostDto,
} from './dto/posts.dto';
import { PostsService } from './posts.service';

@Controller()
@UseGuards(AuthGuard)
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Post('posts')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePostDto) {
    return this.posts.create(user.userId, dto);
  }

  @Get('families/:id/feed')
  feed(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.posts.getFeed(id, user.userId, {
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('families/:id/my-posts')
  myPosts(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.posts.listMyPosts(id, user.userId);
  }

  @Get('posts/:id')
  getOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.posts.getPost(id, user.userId);
  }

  @Post('posts/:id/reactions')
  react(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReactPostDto,
  ) {
    return this.posts.react(id, user.userId, dto);
  }

  @Post('posts/:id/comments')
  comment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CommentPostDto,
  ) {
    return this.posts.comment(id, user.userId, dto);
  }
}
