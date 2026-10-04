import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { DB, type Db } from '../db/db.js';
import { sdkVersions } from '../db/schema.js';
import { effectiveStatus, type SdkStatus } from './lifecycle.js';

export type { SdkStatus };

export interface SdkInfo {
  major: number;
  status: SdkStatus;
  adapterUrl: string | null;
  sri: string | null;
  deprecatedAt: string | null;
  eolAt: string | null;
}

@Injectable()
export class SdkService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list(): Promise<SdkInfo[]> {
    return (await this.db.select().from(sdkVersions).orderBy(sdkVersions.major)).map(toInfo);
  }

  /** The major with its status in force now (dates applied). */
  async find(major: number): Promise<SdkInfo | null> {
    const [row] = await this.db.select().from(sdkVersions).where(eq(sdkVersions.major, major));
    return row ? toInfo(row) : null;
  }

  async get(major: number): Promise<SdkInfo> {
    const info = await this.find(major);
    if (!info) {
      throw new NotFoundException(`SDK v${major} is not registered`);
    }
    return info;
  }
}

export function toInfo(row: typeof sdkVersions.$inferSelect): SdkInfo {
  return {
    major: row.major,
    status: effectiveStatus(row),
    adapterUrl: row.adapterUrl,
    sri: row.sri,
    deprecatedAt: row.deprecatedAt?.toISOString() ?? null,
    eolAt: row.eolAt?.toISOString() ?? null,
  };
}
