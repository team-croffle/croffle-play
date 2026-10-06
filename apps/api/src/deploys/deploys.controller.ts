import { Body, Controller, Inject, Param, Post, UseGuards } from '@nestjs/common';

import { AdminGuard } from '../auth/admin.guard.js';
import { CurrentUser } from '../auth/user.guard.js';
import { GameIdPipe } from '../common/game-id.pipe.js';
import { Limit, SubjectThrottlerGuard } from '../common/rate-limit.js';
import { GameMemberGuard } from '../members/game-member.guard.js';
import type { User } from '../users/users.service.js';
import { DeployService, type DeployView, requireZip } from './deploy.service.js';

/** Platform hosting, by admins. */
@Controller('admin/games/:id/deploys')
@UseGuards(AdminGuard, SubjectThrottlerGuard)
export class AdminDeploysController {
  constructor(@Inject(DeployService) private readonly deploys: DeployService) {}

  @Post()
  @Limit.upload()
  upload(
    @Param('id', GameIdPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: User,
  ): Promise<DeployView> {
    return this.deploys.upload(id, requireZip(body), { userId: user.id });
  }
}

/** Platform hosting, by the game's members (portal `/dev`). */
@Controller('me/games/:id/deploys')
@UseGuards(GameMemberGuard, SubjectThrottlerGuard)
export class MyDeploysController {
  constructor(@Inject(DeployService) private readonly deploys: DeployService) {}

  @Post()
  @Limit.upload()
  upload(
    @Param('id', GameIdPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: User,
  ): Promise<DeployView> {
    return this.deploys.upload(id, requireZip(body), { userId: user.id });
  }
}
