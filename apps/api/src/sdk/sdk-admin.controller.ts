import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import * as v from 'valibot';

import { AdminGuard } from '../auth/admin.guard.js';
import { CurrentUser } from '../auth/user.guard.js';
import { ValibotPipe } from '../common/valibot.pipe.js';
import type { User } from '../users/users.service.js';
import type { SyncResult } from './adapter-install.service.js';
import { MAX_PLAYABLE_MAJORS, PLAYABLE_STATUSES } from './lifecycle.js';
import { type SdkDetail, SdkAdminService } from './sdk-admin.service.js';
import { type SdkInfo, SdkService } from './sdk.service.js';

const isoDate = v.pipe(v.string(), v.isoTimestamp());
const lifecycleSchema = v.object({
  status: v.optional(v.picklist(['current', 'lts', 'old', 'deprecated'])),
  oldAt: v.optional(v.nullable(isoDate)),
  deprecatedAt: v.optional(v.nullable(isoDate)),
  /** The major number, typed again, to deprecate. */
  confirm: v.optional(v.number()),
});
const adapterSchema = v.object({ version: v.pipe(v.string(), v.minLength(1), v.maxLength(64)) });

@Controller('admin/sdk')
@UseGuards(AdminGuard)
export class SdkAdminController {
  constructor(
    @Inject(SdkService) private readonly sdk: SdkService,
    @Inject(SdkAdminService) private readonly admin: SdkAdminService,
  ) {}

  /** Every major with its status in force, plus policy warnings. */
  @Get()
  async list(): Promise<{ items: SdkInfo[]; warnings: string[] }> {
    const items = await this.sdk.list();
    const playable = items.filter((i) => PLAYABLE_STATUSES.includes(i.status)).length;
    return {
      items,
      warnings:
        playable > MAX_PLAYABLE_MAJORS
          ? [`${playable} SDK majors are playable; the policy allows ${MAX_PLAYABLE_MAJORS}`]
          : [],
    };
  }

  /** Installs the newest compatible adapter release of every playable major, now. */
  @Post('sync')
  @HttpCode(200)
  async sync(): Promise<{ results: SyncResult[] }> {
    return { results: await this.admin.syncNow() };
  }

  /** One major: lifecycle, registered adapter versions, what npm offers, recent admin changes. */
  @Get(':major')
  detail(@Param('major', ParseIntPipe) major: number): Promise<SdkDetail> {
    return this.admin.detail(major);
  }

  /** Installs a release from npm and serves it. */
  @Post(':major/adapters')
  @HttpCode(200)
  install(
    @Param('major', ParseIntPipe) major: number,
    @Body(new ValibotPipe(adapterSchema)) body: v.InferOutput<typeof adapterSchema>,
    @CurrentUser() user: User,
  ): Promise<SdkDetail> {
    return this.admin.installAdapter(major, body.version, user.id);
  }

  /** Removes an inactive registered version. */
  @Delete(':major/adapters/:version')
  remove(
    @Param('major', ParseIntPipe) major: number,
    @Param('version') version: string,
    @CurrentUser() user: User,
  ): Promise<SdkDetail> {
    return this.admin.removeAdapter(major, version, user.id);
  }

  /** Serve an already registered adapter version again (rollback). */
  @Post(':major/adapter')
  @HttpCode(200)
  activate(
    @Param('major', ParseIntPipe) major: number,
    @Body(new ValibotPipe(adapterSchema)) body: v.InferOutput<typeof adapterSchema>,
    @CurrentUser() user: User,
  ): Promise<SdkDetail> {
    return this.admin.activateAdapter(major, body.version, user.id);
  }

  /** Lifecycle status and dates — forward only; deprecating needs `confirm`. */
  @Patch(':major')
  lifecycle(
    @Param('major', ParseIntPipe) major: number,
    @Body(new ValibotPipe(lifecycleSchema)) body: v.InferOutput<typeof lifecycleSchema>,
    @CurrentUser() user: User,
  ): Promise<SdkDetail> {
    return this.admin.setLifecycle(major, body, user.id);
  }
}
