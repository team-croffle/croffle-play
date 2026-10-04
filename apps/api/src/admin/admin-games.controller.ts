import { gameIdSchema } from '@croffledev/play-protocol';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import * as v from 'valibot';

import { AdminGuard } from '../auth/admin.guard.js';
import { GameIdPipe } from '../common/game-id.pipe.js';
import { ValibotPipe } from '../common/valibot.pipe.js';
import { type PlayInfo, PlayService } from '../games/play.service.js';
import { type AdminGame, AdminGamesService, type AdminVersion } from './admin-games.service.js';

/** Upper bound an admin may grant for one game's bundles. */
const MAX_APPROVABLE_BUNDLE_BYTES = 200 * 1024 * 1024;

const name = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(60));
const description = v.pipe(v.string(), v.maxLength(2000));
const createSchema = v.object({ id: gameIdSchema, name, description: v.optional(description, '') });
const updateSchema = v.object({
  name: v.optional(name),
  description: v.optional(description),
  maxBundleBytes: v.optional(
    v.nullable(
      v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(MAX_APPROVABLE_BUNDLE_BYTES)),
    ),
  ),
});
const rollbackSchema = v.object({ version: v.string() });

@Controller('admin/games')
@UseGuards(AdminGuard)
export class AdminGamesController {
  constructor(
    @Inject(AdminGamesService) private readonly games: AdminGamesService,
    @Inject(PlayService) private readonly play: PlayService,
  ) {}

  @Post()
  create(
    @Body(new ValibotPipe(createSchema)) body: v.InferOutput<typeof createSchema>,
  ): Promise<AdminGame> {
    return this.games.create(body);
  }

  @Get()
  async list(): Promise<{ items: AdminGame[] }> {
    return { items: await this.games.list() };
  }

  @Get(':id')
  get(@Param('id', GameIdPipe) id: string): Promise<AdminGame & { versions: AdminVersion[] }> {
    return this.games.get(id);
  }

  @Patch(':id')
  update(
    @Param('id', GameIdPipe) id: string,
    @Body(new ValibotPipe(updateSchema)) body: v.InferOutput<typeof updateSchema>,
  ): Promise<AdminGame> {
    return this.games.update(id, body);
  }

  @Get(':id/versions/:version/play')
  playInfo(
    @Param('id', GameIdPipe) id: string,
    @Param('version') version: string,
  ): Promise<PlayInfo> {
    return this.play.info(id, version, { anyVersion: true });
  }

  @Post(':id/versions/:version/approve')
  @HttpCode(200)
  approve(
    @Param('id', GameIdPipe) id: string,
    @Param('version') version: string,
  ): Promise<AdminGame> {
    return this.games.approve(id, version);
  }

  @Post(':id/versions/:version/reject')
  @HttpCode(200)
  reject(
    @Param('id', GameIdPipe) id: string,
    @Param('version') version: string,
  ): Promise<AdminGame> {
    return this.games.reject(id, version);
  }

  @Post(':id/rollback')
  @HttpCode(200)
  rollback(
    @Param('id', GameIdPipe) id: string,
    @Body(new ValibotPipe(rollbackSchema)) body: { version: string },
  ): Promise<AdminGame> {
    return this.games.rollback(id, body.version);
  }
}
