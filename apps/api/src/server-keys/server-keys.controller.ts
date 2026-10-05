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
import { type ServerKeyView, ServerKeysService } from './server-keys.service.js';

const issueSchema = v.object({ label: v.optional(v.pipe(v.string(), v.maxLength(80)), '') });

@Controller('admin/games/:id/server-keys')
@UseGuards(AdminGuard)
export class ServerKeysController {
  constructor(@Inject(ServerKeysService) private readonly keys: ServerKeysService) {}

  @Post()
  issue(
    @Param('id', GameIdPipe) id: string,
    @Body(new ValibotPipe(v.optional(issueSchema, {}))) body: v.InferOutput<typeof issueSchema>,
  ): Promise<{ key: string } & ServerKeyView> {
    return this.keys.issue(id, body.label);
  }

  @Get()
  async list(@Param('id', GameIdPipe) id: string): Promise<{ items: ServerKeyView[] }> {
    return { items: await this.keys.list(id) };
  }

  /** New key now; the old one expires in 24 hours. */
  @Post(':keyId/rotate')
  rotate(
    @Param('id', GameIdPipe) id: string,
    @Param('keyId', ParseUUIDPipe) keyId: string,
  ): Promise<{ key: string } & ServerKeyView> {
    return this.keys.rotate(id, keyId);
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
