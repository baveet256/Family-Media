import {
  Body,
  Controller,
  Delete,
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
import {
  AddParticipantsDto,
  CreateChatDto,
  RenameChatDto,
  SendMessageDto,
  SetParticipantRoleDto,
} from './dto/chats.dto';
import { ChatsService } from './chats.service';

@Controller()
@UseGuards(AuthGuard)
export class ChatsController {
  constructor(private readonly chats: ChatsService) {}

  @Get('families/:id/members')
  members(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.chats.listMembers(id, user.userId);
  }

  @Get('chats')
  list(
    @CurrentUser() user: AuthUser,
    @Query('familyId') familyId: string,
  ) {
    return this.chats.listChats(familyId, user.userId);
  }

  @Post('chats')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateChatDto) {
    return this.chats.createChat(user.userId, dto);
  }

  @Get('chats/:id')
  detail(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.chats.getChatDetail(id, user.userId);
  }

  @Patch('chats/:id')
  rename(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenameChatDto,
  ) {
    return this.chats.renameChat(id, user.userId, dto.name);
  }

  @Post('chats/:id/participants')
  addParticipants(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddParticipantsDto,
  ) {
    return this.chats.addParticipants(id, user.userId, dto.userIds);
  }

  @Patch('chats/:id/participants/:userId')
  setRole(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) targetId: string,
    @Body() dto: SetParticipantRoleDto,
  ) {
    return this.chats.setParticipantRole(id, user.userId, targetId, dto.role);
  }

  @Delete('chats/:id/participants/:userId')
  removeParticipant(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) targetId: string,
  ) {
    return this.chats.removeParticipant(id, user.userId, targetId);
  }

  @Post('chats/:id/leave')
  leave(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.chats.leaveChat(id, user.userId);
  }

  @Get('chats/:id/messages')
  messages(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('after') after?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chats.getMessages(id, user.userId, {
      after,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('chats/:id/messages')
  send(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chats.sendMessage(id, user.userId, dto);
  }

  @Post('chats/:id/read')
  read(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.chats.markRead(id, user.userId);
  }
}
