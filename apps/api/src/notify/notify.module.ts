import { type DynamicModule, Module } from '@nestjs/common';

import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { SdkModule } from '../sdk/sdk.module.js';
import { GithubIssueNotifier, LogNotifier, NOTIFIER, type Notifier } from './notifier.js';
import { SdkNoticesService } from './sdk-notices.service.js';

@Module({})
export class NotifyModule {
  static forRoot(notifier?: Notifier): DynamicModule {
    return {
      module: NotifyModule,
      imports: [SdkModule],
      providers: [
        notifier
          ? { provide: NOTIFIER, useValue: notifier }
          : {
              provide: NOTIFIER,
              inject: [ENV],
              useFactory: (env: Env) =>
                env.GITHUB_NOTIFY_TOKEN
                  ? new GithubIssueNotifier(env.GITHUB_NOTIFY_TOKEN, env.GITHUB_API_URL)
                  : new LogNotifier(),
            },
        SdkNoticesService,
      ],
      exports: [SdkNoticesService],
    };
  }
}
