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
import { ValibotPipe } from '../common/valibot.pipe.js';
import { type DeployKeyView, DeployKeysService } from './deploy-keys.service.js';

const issueSchema = v.object({ label: v.optional(v.pipe(v.string(), v.maxLength(80)), '') });

@Controller('admin/games/:id/deploy-keys')
@UseGuards(AdminGuard)
export class DeployKeysController {
  constructor(@Inject(DeployKeysService) private readonly keys: DeployKeysService) {}

  @Post()
  issue(
    @Param('id') id: string,
    @Body(new ValibotPipe(v.optional(issueSchema, {}))) body: { label: string },
  ): Promise<{ key: string } & DeployKeyView> {
    return this.keys.issue(id, body.label);
  }

  @Get()
  async list(@Param('id') id: string): Promise<{ items: DeployKeyView[] }> {
    return { items: await this.keys.list(id) };
  }

  @Delete(':keyId')
  @HttpCode(204)
  revoke(@Param('id') id: string, @Param('keyId', ParseUUIDPipe) keyId: string): Promise<void> {
    return this.keys.revoke(id, keyId);
  }
}
