import {
  Controller,
  Get,
  Header,
  Inject,
  NotFoundException,
  Param,
  StreamableFile,
} from '@nestjs/common';

import { STORAGE, type Storage } from '../storage/storage.js';
import { ADAPTER_VERSION, adapterKey } from './register-adapter.js';

/**
 * Host adapter bundles (design invariant 6), from storage. The portal relays this route on its
 * own origin and checks the SRI hash before importing, so the API only serves bytes.
 */
@Controller('adapters')
export class AdaptersController {
  constructor(@Inject(STORAGE) private readonly storage: Storage) {}

  @Get(':major/:version/index.js')
  @Header('Content-Type', 'text/javascript; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  async bundle(
    @Param('major') major: string,
    @Param('version') version: string,
  ): Promise<StreamableFile> {
    const m = /^v([1-9][0-9]{0,2})$/.exec(major);
    if (!m || !ADAPTER_VERSION.test(version)) {
      throw new NotFoundException();
    }
    const file = await this.storage.get(adapterKey(Number(m[1]), version));
    if (!file) {
      throw new NotFoundException();
    }
    return new StreamableFile(file.body);
  }
}
