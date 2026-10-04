import { Module } from '@nestjs/common';

import { GamesModule } from '../games/games.module.js';
import { SavesController } from './saves.controller.js';

@Module({ imports: [GamesModule], controllers: [SavesController] })
export class SavesModule {}
