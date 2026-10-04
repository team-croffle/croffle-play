import { Controller, Get, HttpCode, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { AdminGuard } from '../auth/admin.guard.js';
import { CurrentUser } from '../auth/user.guard.js';
import { GameIdPipe } from '../common/game-id.pipe.js';
import { DB, type Db } from '../db/db.js';
import { games } from '../db/schema.js';
import type { User } from '../users/users.service.js';
import { type GameServerView, GameServersService, toView } from './game-servers.service.js';

/** Approved game server address for the game itself (via the adapter). */
@Controller('games/:id/server')
export class GameServerPublicController {
  constructor(@Inject(GameServersService) private readonly servers: GameServersService) {}

  @Get()
  info(@Param('id', GameIdPipe) id: string): Promise<{ url: string; protocol: string }> {
    return this.servers.publicInfo(id);
  }
}

@Controller('admin')
@UseGuards(AdminGuard)
export class GameServersAdminController {
  constructor(
    @Inject(GameServersService) private readonly servers: GameServersService,
    @Inject(DB) private readonly db: Db,
  ) {}

  @Get('game-servers')
  async list(): Promise<{ items: GameServerView[] }> {
    return { items: await this.servers.list() };
  }

  @Get('games/:id/server')
  async get(@Param('id', GameIdPipe) id: string): Promise<GameServerView> {
    return this.view(id, await this.servers.get(id));
  }

  @Post('games/:id/server/approve')
  @HttpCode(200)
  async approve(
    @Param('id', GameIdPipe) id: string,
    @CurrentUser() admin: User,
  ): Promise<GameServerView> {
    return this.view(id, await this.servers.approve(id, admin.id));
  }

  @Post('games/:id/server/revoke')
  @HttpCode(200)
  async revoke(@Param('id', GameIdPipe) id: string): Promise<GameServerView> {
    return this.view(id, await this.servers.revoke(id));
  }

  private async view(id: string, s: Awaited<ReturnType<GameServersService['get']>>) {
    const [g] = await this.db.select({ name: games.name }).from(games).where(eq(games.id, id));
    return toView(s, g?.name ?? id);
  }
}
