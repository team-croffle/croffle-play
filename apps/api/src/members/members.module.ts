import { Module } from '@nestjs/common';

import { MembersAdminController, MyGamesController } from './members.controller.js';
import { MembersService } from './members.service.js';

@Module({ controllers: [MyGamesController, MembersAdminController], providers: [MembersService] })
export class MembersModule {}
