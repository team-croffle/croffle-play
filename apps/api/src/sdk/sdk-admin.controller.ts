import { Controller, Get, Inject, UseGuards } from '@nestjs/common';

import { AdminGuard } from '../auth/admin.guard.js';
import { MAX_PLAYABLE_MAJORS, PLAYABLE_STATUSES } from './lifecycle.js';
import { type SdkInfo, SdkService } from './sdk.service.js';

@Controller('admin/sdk')
@UseGuards(AdminGuard)
export class SdkAdminController {
  constructor(@Inject(SdkService) private readonly sdk: SdkService) {}

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
}
