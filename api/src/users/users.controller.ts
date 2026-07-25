import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/guards/auth.guard';
import { UpdateUserDto } from '../families/dto/family.dto';
import { UsersService } from './users.service';
import { AuditService } from '../audit/audit.service';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthUser) {
    return this.users.getMe(user.userId);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateUserDto) {
    return this.users.updateMe(user.userId, dto);
  }

  @Get('me/export')
  exportMe(@CurrentUser() user: AuthUser) {
    return this.users.exportMyData(user.userId);
  }

  @Delete('me')
  async deleteMe(@CurrentUser() user: AuthUser) {
    await this.audit.log({
      actorUserId: user.userId,
      entityType: 'user',
      entityId: user.userId,
      action: 'account.delete',
    });
    return this.users.deleteAccount(user.userId);
  }
}
