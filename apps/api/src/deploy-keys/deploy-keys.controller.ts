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
  Req,
  UseGuards,
} from '@nestjs/common';
import * as v from 'valibot';

import { AdminGuard } from '../auth/admin.guard.js';
import { GameIdPipe } from '../common/game-id.pipe.js';
import { Limit, SubjectThrottlerGuard } from '../common/rate-limit.js';
import { ValibotPipe } from '../common/valibot.pipe.js';
import { DeployService, type DeployView, requireZip } from '../deploys/deploy.service.js';
import { GameMemberGuard } from '../members/game-member.guard.js';
import { DeployKeyGuard, type DeployKeyRequest } from './deploy-key.guard.js';
import { type DeployKeyView, DeployKeysService } from './deploy-keys.service.js';

const issueSchema = v.object({ label: v.optional(v.pipe(v.string(), v.maxLength(80)), '') });
type IssueBody = v.InferOutput<typeof issueSchema>;

/** Issue, list, rotate and revoke a game's deploy keys; shared by the admin and member routes. */
abstract class DeployKeysRoutes {
  constructor(protected readonly keys: DeployKeysService) {}

  @Post()
  issue(
    @Param('id', GameIdPipe) id: string,
    @Body(new ValibotPipe(v.optional(issueSchema, {}))) body: IssueBody,
  ): Promise<{ key: string } & DeployKeyView> {
    return this.keys.issue(id, body.label);
  }

  @Get()
  async list(@Param('id', GameIdPipe) id: string): Promise<{ items: DeployKeyView[] }> {
    return { items: await this.keys.list(id) };
  }

  /** New key now; the old one expires in 24 hours. */
  @Post(':keyId/rotate')
  rotate(
    @Param('id', GameIdPipe) id: string,
    @Param('keyId', ParseUUIDPipe) keyId: string,
  ): Promise<{ key: string } & DeployKeyView> {
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

@Controller('admin/games/:id/deploy-keys')
@UseGuards(AdminGuard)
export class AdminDeployKeysController extends DeployKeysRoutes {
  constructor(@Inject(DeployKeysService) keys: DeployKeysService) {
    super(keys);
  }
}

/** The game's members (portal `/dev`). */
@Controller('me/games/:id/deploy-keys')
@UseGuards(GameMemberGuard)
export class MyDeployKeysController extends DeployKeysRoutes {
  constructor(@Inject(DeployKeysService) keys: DeployKeysService) {
    super(keys);
  }
}

/** Upload with a deploy key (CI, `play-cli deploy`): no browser session involved. */
@Controller('games/:id/deploys')
@UseGuards(DeployKeyGuard, SubjectThrottlerGuard)
export class KeyDeploysController {
  constructor(@Inject(DeployService) private readonly deploys: DeployService) {}

  @Post()
  @Limit.upload()
  upload(
    @Param('id', GameIdPipe) id: string,
    @Body() body: unknown,
    @Req() req: DeployKeyRequest,
  ): Promise<DeployView> {
    const key = req.deployKey;
    return this.deploys.upload(id, requireZip(body), key ? { deployKeyId: key.id } : {});
  }
}
