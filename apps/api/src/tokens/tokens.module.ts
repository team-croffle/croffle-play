import { Module } from '@nestjs/common';

import { GamesModule } from '../games/games.module.js';
import { SigningKeys } from './signing-keys.js';
import { JwksController, TokensController } from './tokens.controller.js';

@Module({
  imports: [GamesModule],
  controllers: [JwksController, TokensController],
  providers: [SigningKeys],
})
export class TokensModule {}
