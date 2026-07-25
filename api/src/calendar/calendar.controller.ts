import {
  Body,
  Controller,
  Delete,
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
import { CalendarService } from './calendar.service';
import { CreateOccasionDto, UpcomingQueryDto } from './dto/calendar.dto';

@Controller()
@UseGuards(AuthGuard)
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get('families/:id/upcoming')
  upcoming(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: UpcomingQueryDto,
  ) {
    return this.calendar.getUpcoming(id, user.userId, query);
  }

  @Post('occasions')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOccasionDto) {
    return this.calendar.createOccasion(user.userId, dto);
  }

  @Delete('occasions/:id')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.calendar.deleteOccasion(id, user.userId);
  }
}
