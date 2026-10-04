import { Body, Controller, Get, Inject, Put, UseGuards } from '@nestjs/common';
import * as v from 'valibot';

import { CurrentUser, UserGuard } from '../auth/user.guard.js';
import { ValibotPipe } from '../common/valibot.pipe.js';
import { type PublicUser, toPublicUser, type User, UsersService } from './users.service.js';

const profileSchema = v.object({
  nickname: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(24)),
  avatar: v.nullable(v.pipe(v.string(), v.url(), v.startsWith('https://'), v.maxLength(500))),
});

type Me = PublicUser & { role: User['role'] };

@Controller('me')
@UseGuards(UserGuard)
export class MeController {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}

  @Get()
  me(@CurrentUser() user: User): Me {
    return { ...toPublicUser(user), role: user.role };
  }

  /** The shell syncs the IdP profile here after sign-in. */
  @Put()
  async update(
    @CurrentUser() user: User,
    @Body(new ValibotPipe(profileSchema)) body: v.InferOutput<typeof profileSchema>,
  ): Promise<Me> {
    const updated = await this.users.updateProfile(user.id, body);
    return { ...toPublicUser(updated), role: updated.role };
  }
}
