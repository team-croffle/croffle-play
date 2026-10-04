import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import * as v from 'valibot';

import { AdminGuard } from '../auth/admin.guard.js';
import { CurrentUser, UserGuard } from '../auth/user.guard.js';
import { GameIdPipe } from '../common/game-id.pipe.js';
import { ValibotPipe } from '../common/valibot.pipe.js';
import type { User } from '../users/users.service.js';
import { type MemberRole, MembersService, type MyGame } from './members.service.js';

const roleSchema = v.object({ role: v.picklist(['owner', 'developer']) });
const querySchema = v.pipe(v.optional(v.string(), ''), v.trim(), v.minLength(1), v.maxLength(40));

@Controller('me/games')
@UseGuards(UserGuard)
export class MyGamesController {
  constructor(@Inject(MembersService) private readonly members: MembersService) {}

  @Get()
  async list(@CurrentUser() user: User): Promise<{ items: MyGame[] }> {
    return { items: await this.members.myGames(user.id) };
  }
}

@Controller('admin')
@UseGuards(AdminGuard)
export class MembersAdminController {
  constructor(@Inject(MembersService) private readonly members: MembersService) {}

  @Get('games/:id/members')
  async list(@Param('id', GameIdPipe) id: string) {
    return { items: await this.members.list(id) };
  }

  @Put('games/:id/members/:userId')
  @HttpCode(204)
  set(
    @Param('id', GameIdPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body(new ValibotPipe(roleSchema)) body: { role: MemberRole },
  ): Promise<void> {
    return this.members.set(id, userId, body.role);
  }

  @Delete('games/:id/members/:userId')
  @HttpCode(204)
  remove(
    @Param('id', GameIdPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    return this.members.remove(id, userId);
  }

  @Get('users')
  async search(@Query('q', new ValibotPipe(querySchema)) q: string) {
    return { items: await this.members.searchUsers(q) };
  }
}
