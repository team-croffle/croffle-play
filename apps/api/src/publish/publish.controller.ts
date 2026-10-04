import { Body, Controller, HttpCode, Inject, Param, Post, UseGuards } from '@nestjs/common';

import { GameIdPipe } from '../common/game-id.pipe.js';
import { Limit, SubjectThrottlerGuard } from '../common/rate-limit.js';
import { ValibotPipe } from '../common/valibot.pipe.js';
import { DeployKeyGuard } from '../deploy-keys/deploy-key.guard.js';
import { type CreateVersionBody, createVersionSchema } from './publish.schemas.js';
import { type CreatedVersion, PublishService } from './publish.service.js';

/** Called by `play-cli publish` with the game's deploy key. */
@Controller('games/:id/versions')
@UseGuards(DeployKeyGuard)
export class PublishController {
  constructor(@Inject(PublishService) private readonly publish: PublishService) {}

  @Post()
  @UseGuards(SubjectThrottlerGuard)
  @Limit.publish()
  create(
    @Param('id', GameIdPipe) id: string,
    @Body(new ValibotPipe(createVersionSchema)) body: CreateVersionBody,
  ): Promise<CreatedVersion> {
    return this.publish.create(id, body);
  }

  @Post(':version/complete')
  @UseGuards(SubjectThrottlerGuard)
  @Limit.complete()
  @HttpCode(200)
  complete(
    @Param('id', GameIdPipe) id: string,
    @Param('version') version: string,
  ): Promise<{ version: string; previewUrl: string }> {
    return this.publish.complete(id, version);
  }
}
