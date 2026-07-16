import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/guards/auth.guard';
import { TreeService } from './tree.service';

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
}
