import { MAX_SAVE_LENGTH, slotSchema } from '@croffledev/play-protocol';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  PayloadTooLargeException,
  Put,
  UseGuards,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import * as v from 'valibot';

import { CurrentUser, UserGuard } from '../auth/user.guard.js';
import { GameIdPipe } from '../common/game-id.pipe.js';
import { ValibotPipe } from '../common/valibot.pipe.js';
import { DB, type Db } from '../db/db.js';
import { saves } from '../db/schema.js';
import { GamesService } from '../games/games.service.js';
import type { User } from '../users/users.service.js';

const bodySchema = v.object({ data: v.string() });

/** Save slots of the signed-in player (`sdk.save` / `sdk.load`). */
@Controller('games/:id/saves/:slot')
@UseGuards(UserGuard)
export class SavesController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(GamesService) private readonly games: GamesService,
  ) {}

  @Get()
  async load(
    @Param('id', GameIdPipe) id: string,
    @Param('slot', new ValibotPipe(slotSchema)) slot: string,
    @CurrentUser() user: User,
  ): Promise<{ data: string | null }> {
    const [row] = await this.db
      .select({ data: saves.data })
      .from(saves)
      .where(and(eq(saves.gameId, id), eq(saves.userId, user.id), eq(saves.slot, slot)));
    return { data: row?.data ?? null };
  }

  @Put()
  @HttpCode(204)
  async save(
    @Param('id', GameIdPipe) id: string,
    @Param('slot', new ValibotPipe(slotSchema)) slot: string,
    @CurrentUser() user: User,
    @Body(new ValibotPipe(bodySchema)) body: { data: string },
  ): Promise<void> {
    if (body.data.length > MAX_SAVE_LENGTH) {
      throw new PayloadTooLargeException(`Saves are limited to ${MAX_SAVE_LENGTH} characters`);
    }
    await this.games.get(id);
    await this.db
      .insert(saves)
      .values({ gameId: id, userId: user.id, slot, data: body.data })
      .onConflictDoUpdate({
        target: [saves.gameId, saves.userId, saves.slot],
        set: { data: body.data, updatedAt: new Date() },
      });
  }
}
