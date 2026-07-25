import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/guards/auth.guard';
import { ConnectionsService } from './connections.service';
import {
  CreateBridgeLinkDto,
  CreateConnectionInviteDto,
  RespondConnectionInviteDto,
  UpdateConnectionDto,
  UpdateContextDto,
} from './dto/connections.dto';
import { PostsService } from '../posts/posts.service';

@Controller()
@UseGuards(AuthGuard)
export class ConnectionsController {
  constructor(
    private readonly connections: ConnectionsService,
    private readonly posts: PostsService,
  ) {}

  @Get('connections')
  list(@CurrentUser() user: AuthUser) {
    return this.connections.listForUser(user.userId);
  }

  @Get('connections/:id')
  get(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.connections.getById(id, user.userId);
  }

  @Patch('connections/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConnectionDto,
  ) {
    return this.connections.updateConnection(id, user.userId, dto);
  }

  @Post('connections/:id/bridge-links')
  bridge(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateBridgeLinkDto,
  ) {
    return this.connections.addBridgeLink(id, user.userId, dto);
  }

  @Get('connections/:id/tree')
  tree(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.connections.getConnectionTree(id, user.userId);
  }

  @Get('connections/:id/feed')
  feed(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('familyId') familyId?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.posts.getConnectionFeed(id, user.userId, {
      familyId,
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('connection-invites')
  createInvite(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateConnectionInviteDto,
  ) {
    return this.connections.createInvite(user.userId, dto);
  }

  @Get('connection-invites')
  listInvites(@CurrentUser() user: AuthUser) {
    return this.connections.listInvites(user.userId);
  }

  @Patch('connection-invites/:id')
  respond(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespondConnectionInviteDto,
  ) {
    return this.connections.respondInvite(id, user.userId, dto);
  }

  @Get('users/me/context')
  getContext(@CurrentUser() user: AuthUser) {
    return this.connections.getContext(user.userId);
  }

  @Patch('users/me/context')
  setContext(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateContextDto,
  ) {
    return this.connections.setContext(user.userId, dto);
  }
}
