import {
  ConflictException,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { AdminGuard } from '../auth/admin.guard.js';
import { CurrentUser } from '../auth/user.guard.js';
import { GameIdPipe } from '../common/game-id.pipe.js';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { DB, type Db } from '../db/db.js';
import { games } from '../db/schema.js';
import type { User } from '../users/users.service.js';
import { renderGameServerCompose } from './compose.js';
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
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get('game-servers')
  async list(): Promise<{ items: GameServerView[] }> {
    return { items: await this.servers.list() };
  }

  @Get('games/:id/server')
  async get(@Param('id', GameIdPipe) id: string): Promise<GameServerView> {
    return this.view(id, await this.servers.get(id));
  }

  /** Compose fragment for the approved image (save as infra/game-servers/<id>.yml). */
  @Get('games/:id/server/compose')
  @Header('Content-Type', 'text/yaml; charset=utf-8')
  async compose(@Param('id', GameIdPipe) id: string): Promise<string> {
    const s = await this.servers.get(id);
    if (s.status !== 'approved') {
      throw new ConflictException(`The game server of '${id}' is ${s.status}, not approved`);
    }
    return renderGameServerCompose(s, {
      publicUrl: this.env.GAME_SERVER_URL_TEMPLATE.replaceAll('{id}', id),
      apiOrigin: this.env.PUBLIC_API_ORIGIN,
    });
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
