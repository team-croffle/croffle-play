import { type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  getOptionsToken,
  getStorageToken,
  Throttle,
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';

import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';

/**
 * Rate limits keyed by who is acting — the player, the server key — not by IP: players
 * reach the API through the shell server, so they all share its address. Put it after the guard
 * that authenticates the request.
 */
@Injectable()
export class SubjectThrottlerGuard extends ThrottlerGuard {
  constructor(
    @Inject(getOptionsToken()) options: ThrottlerModuleOptions,
    @Inject(getStorageToken()) storage: ThrottlerStorage,
    @Inject(Reflector) reflector: Reflector,
    @Inject(ENV) private readonly env: Env,
  ) {
    super(options, storage, reflector);
  }

  protected override async shouldSkip(ctx: ExecutionContext): Promise<boolean> {
    return !this.env.RATE_LIMITS || super.shouldSkip(ctx);
  }

  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req.user as { id?: string } | undefined;
    const key = (req.serverKey ?? req.deployKey) as { id?: string } | undefined;
    if (user?.id) {
      return `user:${user.id}`;
    }
    if (key?.id) {
      return `key:${key.id}`;
    }
    return `ip:${String(req.ip)}`;
  }
}

const minute = 60_000;

/** Per-route limits (requests per window, per subject). */
export const Limit = {
  score: () => Throttle({ default: { limit: 30, ttl: minute } }),
  serverScore: () => Throttle({ default: { limit: 600, ttl: minute } }),
  token: () => Throttle({ default: { limit: 30, ttl: minute } }),
  saveWrite: () => Throttle({ default: { limit: 60, ttl: minute } }),
  saveRead: () => Throttle({ default: { limit: 120, ttl: minute } }),
  profile: () => Throttle({ default: { limit: 10, ttl: minute } }),
  upload: () => Throttle({ default: { limit: 10, ttl: minute } }),
} as const;
