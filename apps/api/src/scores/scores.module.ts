import { Module } from '@nestjs/common';

import { GamesModule } from '../games/games.module.js';
import { ScoresController } from './scores.controller.js';
import { ScoresService } from './scores.service.js';

@Module({ imports: [GamesModule], controllers: [ScoresController], providers: [ScoresService] })
export class ScoresModule {}
