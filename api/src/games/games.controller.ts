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
import { CreateRoundDto, SubmitEntryDto, VoteDto } from './dto/games.dto';
import { GamesService } from './games.service';

@Controller()
@UseGuards(AuthGuard)
export class GamesController {
  constructor(private readonly games: GamesService) {}

  @Get('families/:id/games')
  hub(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.games.getHub(id, user.userId);
  }

  @Get('games/prompts')
  prompts() {
    return this.games.suggestions();
  }

  @Post('games/rounds')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRoundDto) {
    return this.games.createRound(user.userId, dto);
  }

  @Get('games/rounds/:id')
  round(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.games.getRound(id, user.userId);
  }

  @Post('games/rounds/:id/entries')
  submit(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitEntryDto,
  ) {
    return this.games.submitEntry(id, user.userId, dto);
  }

  @Post('games/rounds/:id/vote')
  vote(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoteDto,
  ) {
    return this.games.vote(id, user.userId, dto);
  }

  @Post('games/rounds/:id/advance')
  advance(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.games.advance(id, user.userId);
  }
}
