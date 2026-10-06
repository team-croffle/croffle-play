import { Body, Controller, Get, HttpCode, Inject, Param, Post, UseGuards } from '@nestjs/common';

import { AdminGuard } from '../auth/admin.guard.js';
import { CurrentUser } from '../auth/user.guard.js';
import { GameIdPipe } from '../common/game-id.pipe.js';
import { Limit, SubjectThrottlerGuard } from '../common/rate-limit.js';
import { GameMemberGuard } from '../members/game-member.guard.js';
import type { User } from '../users/users.service.js';
import { DeployService, type DeployView, requireZip } from './deploy.service.js';

/** Upload, history and rollback of platform-hosted builds; shared by the admin and member routes. */
abstract class DeploysRoutes {
  constructor(protected readonly deploys: DeployService) {}

  @Post()
  @Limit.upload()
  upload(
    @Param('id', GameIdPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: User,
  ): Promise<DeployView> {
    return this.deploys.upload(id, requireZip(body), { userId: user.id });
  }

  /** Newest first; the active one is marked. */
  @Get()
  async list(@Param('id', GameIdPipe) id: string): Promise<{ items: DeployView[] }> {
    return { items: await this.deploys.list(id) };
  }

  /** Serves an earlier upload again (rollback). */
  @Post(':deployId/activate')
  @HttpCode(200)
  activate(
    @Param('id', GameIdPipe) id: string,
    @Param('deployId') deployId: string,
  ): Promise<DeployView> {
    return this.deploys.rollback(id, deployId);
  }
}

@Controller('admin/games/:id/deploys')
@UseGuards(AdminGuard, SubjectThrottlerGuard)
export class AdminDeploysController extends DeploysRoutes {
  constructor(@Inject(DeployService) deploys: DeployService) {
    super(deploys);
  }
}

/** The game's members (portal `/dev`). */
@Controller('me/games/:id/deploys')
@UseGuards(GameMemberGuard, SubjectThrottlerGuard)
export class MyDeploysController extends DeploysRoutes {
  constructor(@Inject(DeployService) deploys: DeployService) {
    super(deploys);
  }
}
