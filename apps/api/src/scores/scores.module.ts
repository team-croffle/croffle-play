import { Module } from '@nestjs/common';

import { GamesModule } from '../games/games.module.js';
import { ScoresController } from './scores.controller.js';

@Module({ imports: [GamesModule], controllers: [ScoresController] })
export class ScoresModule {}
