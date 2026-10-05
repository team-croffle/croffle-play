import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Put,
  Res,
  StreamableFile,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import { CurrentUser, UserGuard } from '../auth/user.guard.js';
import { Limit, SubjectThrottlerGuard } from '../common/rate-limit.js';
import { IMMUTABLE_CACHE_CONTROL, STORAGE, type Storage } from '../storage/storage.js';
import { checkAvatar } from './avatar.js';
import { type PublicUser, toPublicUser, type User, UsersService } from './users.service.js';

const FILE = /^[0-9a-f]{32}\.(png|jpeg|webp)$/;
const UUID = /^[0-9a-f-]{36}$/;

/**
 * Player avatars in storage (`avatars/<user>/<hash>.<ext>`). The portal relays `/avatars/…` on its
 * own origin, like host adapters.
 */
@Controller()
export class AvatarsController {
  constructor(
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(STORAGE) private readonly storage: Storage,
  ) {}

  /** Raw image body (PNG, JPEG, or WebP; ≤ 512 KB). */
  @Put('me/avatar')
  @UseGuards(UserGuard, SubjectThrottlerGuard)
  @Limit.profile()
  async upload(@CurrentUser() user: User, @Body() body: unknown): Promise<PublicUser> {
    const check = checkAvatar(body instanceof Uint8Array ? body : new Uint8Array());
    if (!check.ok) {
      throw new UnprocessableEntityException(check.reason);
    }
    const file = `${check.hash}.${check.ext}`;
    await this.storage.put(`avatars/${user.id}/${file}`, {
      body: check.body,
      contentType: check.contentType,
      cacheControl: IMMUTABLE_CACHE_CONTROL,
    });
    return toPublicUser(await this.users.setAvatar(user.id, `/avatars/${user.id}/${file}`));
  }

  @Delete('me/avatar')
  @UseGuards(UserGuard)
  async remove(@CurrentUser() user: User): Promise<PublicUser> {
    return toPublicUser(await this.users.setAvatar(user.id, null));
  }

  @Get('avatars/:userId/:file')
  async serve(
    @Param('userId') userId: string,
    @Param('file') file: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<StreamableFile> {
    if (!UUID.test(userId) || !FILE.test(file)) {
      throw new NotFoundException();
    }
    const stored = await this.storage.get(`avatars/${userId}/${file}`);
    if (!stored) {
      throw new NotFoundException();
    }
    reply.header('cache-control', IMMUTABLE_CACHE_CONTROL);
    return new StreamableFile(stored.body, { type: stored.contentType });
  }
}
