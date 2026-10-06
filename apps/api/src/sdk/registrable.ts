import { UnprocessableEntityException } from '@nestjs/common';

import type { Env } from '../config/env.js';
import { REGISTRABLE_STATUSES } from './lifecycle.js';
import type { SdkService } from './sdk.service.js';

/** A game may be registered, refreshed or uploaded only on a major that accepts registrations. */
export async function assertRegistrable(sdk: SdkService, env: Env, major: number): Promise<void> {
  const info = await sdk.find(major);
  if (!info) {
    throw new UnprocessableEntityException(`SDK v${major} is not supported by the platform`);
  }
  if (!REGISTRABLE_STATUSES.includes(info.status)) {
    throw new UnprocessableEntityException(
      `SDK v${major} is ${info.status}; games must use a supported SDK major. ` +
        `Migration guide: ${env.SDK_MIGRATION_GUIDE_URL}`,
    );
  }
}
