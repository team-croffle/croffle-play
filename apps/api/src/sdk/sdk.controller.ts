import { Controller, Get, Inject, Param, ParseIntPipe } from '@nestjs/common';

import { type SdkInfo, SdkService } from './sdk.service.js';

@Controller('sdk')
export class SdkController {
  constructor(@Inject(SdkService) private readonly sdk: SdkService) {}

  @Get(':major')
  get(@Param('major', ParseIntPipe) major: number): Promise<SdkInfo> {
    return this.sdk.get(major);
  }
}
