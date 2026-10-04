import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import * as v from 'valibot';

import { AdminGuard } from '../auth/admin.guard.js';
import { GameIdPipe } from '../common/game-id.pipe.js';
import { ValibotPipe } from '../common/valibot.pipe.js';
import { type DeployKeyView, DeployKeysService } from './deploy-keys.service.js';

const issueSchema = v.object({
  label: v.optional(v.pipe(v.string(), v.maxLength(80)), ''),
  kind: v.optional(v.picklist(['deploy', 'server']), 'deploy'),
});

@Controller('admin/games/:id/deploy-keys')
@UseGuards(AdminGuard)
export class DeployKeysController {
  constructor(@Inject(DeployKeysService) private readonly keys: DeployKeysService) {}

  @Post()
  issue(
    @Param('id', GameIdPipe) id: string,
    @Body(new ValibotPipe(v.optional(issueSchema, {}))) body: v.InferOutput<typeof issueSchema>,
  ): Promise<{ key: string } & DeployKeyView> {
    return this.keys.issue(id, body.label, body.kind);
  }

  @Get()
  async list(@Param('id', GameIdPipe) id: string): Promise<{ items: DeployKeyView[] }> {
    return { items: await this.keys.list(id) };
  }

  @Delete(':keyId')
  @HttpCode(204)
  revoke(
    @Param('id', GameIdPipe) id: string,
    @Param('keyId', ParseUUIDPipe) keyId: string,
  ): Promise<void> {
    return this.keys.revoke(id, keyId);
  }
}
