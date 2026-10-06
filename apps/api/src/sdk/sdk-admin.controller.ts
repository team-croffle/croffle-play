import {
  Body,
  Controller,
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

  /** One major: lifecycle, registered adapter versions, recent admin changes. */
  @Get(':major')
  detail(@Param('major', ParseIntPipe) major: number): Promise<SdkDetail> {
    return this.admin.detail(major);
  }

  /** Serve a registered adapter version (rollback); undone by the next api start when the image wins. */
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
