import { type DynamicModule, Module } from '@nestjs/common';

import { DeploysModule } from '../deploys/deploys.module.js';
import { GamesModule } from '../games/games.module.js';
import { SdkModule } from '../sdk/sdk.module.js';
import { AdminGamesController } from './admin-games.controller.js';
import { AdminGamesService } from './admin-games.service.js';
import { fetchManifest, MANIFEST_FETCHER, type ManifestFetcher } from './manifest-fetcher.js';
import { RegistryService } from './registry.service.js';

@Module({})
export class AdminModule {
  /** `fetcher` replaces the network read of `game.json` (tests). */
  static forRoot(fetcher: ManifestFetcher = fetchManifest): DynamicModule {
    return {
      module: AdminModule,
      imports: [GamesModule, SdkModule, DeploysModule],
      controllers: [AdminGamesController],
      providers: [
        AdminGamesService,
        RegistryService,
        { provide: MANIFEST_FETCHER, useValue: fetcher },
      ],
      exports: [RegistryService],
    };
  }
}
