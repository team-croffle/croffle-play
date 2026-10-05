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
import { type AdminGame, AdminGamesService } from './admin-games.service.js';

const name = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(60));
const description = v.pipe(v.string(), v.maxLength(2000));
const createSchema = v.object({ id: gameIdSchema, name, description: v.optional(description, '') });
const updateSchema = v.object({
  name: v.optional(name),
  description: v.optional(description),
  /** Shown in the catalog; needs a valid `game.json` on a registrable SDK major. */
  listed: v.optional(v.boolean()),
  scorePolicy: v.optional(v.picklist(['client', 'server'])),
  scoreMin: v.optional(v.nullable(v.pipe(v.number(), v.finite()))),
  scoreMax: v.optional(v.nullable(v.pipe(v.number(), v.finite()))),
  /** GitHub repository for platform notices (`owner/name`). */
  repo: v.optional(v.nullable(v.pipe(v.string(), v.regex(/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/)))),
});

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
  get(@Param('id', GameIdPipe) id: string): Promise<AdminGame> {
    return this.games.get(id);
  }

  @Patch(':id')
  update(
    @Param('id', GameIdPipe) id: string,
    @Body(new ValibotPipe(updateSchema)) body: v.InferOutput<typeof updateSchema>,
  ): Promise<AdminGame> {
    return this.games.update(id, body);
  }

  /** Reads the game's `game.json` again (after the team redeployed it). */
  @Post(':id/refresh')
  @HttpCode(200)
  refresh(@Param('id', GameIdPipe) id: string): Promise<AdminGame> {
    return this.games.refresh(id);
  }

  /** Play info for any registered game, listed or not (admin preview). */
  @Get(':id/play')
  playInfo(@Param('id', GameIdPipe) id: string): Promise<PlayInfo> {
    return this.play.info(id, { includeUnlisted: true });
  }
}
