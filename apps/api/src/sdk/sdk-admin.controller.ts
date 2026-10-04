import { Controller, Get, Inject, UseGuards } from '@nestjs/common';

import { AdminGuard } from '../auth/admin.guard.js';
import { ACTIVE_STATUSES, MAX_ACTIVE_MAJORS } from './lifecycle.js';
import { type SdkInfo, SdkService } from './sdk.service.js';

@Controller('admin/sdk')
@UseGuards(AdminGuard)
export class SdkAdminController {
  constructor(@Inject(SdkService) private readonly sdk: SdkService) {}

  /** Every major with its status in force, plus policy warnings. */
  @Get()
  async list(): Promise<{ items: SdkInfo[]; warnings: string[] }> {
    const items = await this.sdk.list();
    const active = items.filter((i) => ACTIVE_STATUSES.includes(i.status)).length;
    return {
      items,
      warnings:
        active > MAX_ACTIVE_MAJORS
          ? [`${active} SDK majors are active; the policy allows ${MAX_ACTIVE_MAJORS}`]
          : [],
    };
  }
}
