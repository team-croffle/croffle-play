import * as v from 'valibot';

/** Profile a game may see. Never the IdP subject, email, or tokens (design invariant 4). */
export const publicUserSchema = v.object({
  id: v.string(),
  nickname: v.string(),
  avatar: v.nullable(v.string()),
});
export type PublicUser = v.InferOutput<typeof publicUserSchema>;

/** Save slot name. */
export const slotSchema = v.pipe(v.string(), v.regex(/^[a-z0-9_-]{1,32}$/));

/** Largest save payload, in UTF-16 code units of the string (≈ bytes for ASCII/JSON). */
export const MAX_SAVE_LENGTH = 256 * 1024;

const none = v.undefined();

/**
 * Requests a game can send (SDK v1). Adding a request is a minor change and must come with a
 * capability; changing or removing one is a new SDK major.
 */
export const requests = {
  ready: { request: none, response: none },
  getUser: { request: none, response: v.nullable(publicUserSchema) },
  submitScore: {
    request: v.object({ score: v.pipe(v.number(), v.finite()) }),
    response: v.object({ accepted: v.boolean() }),
  },
  save: {
    request: v.object({ slot: slotSchema, data: v.pipe(v.string(), v.maxLength(MAX_SAVE_LENGTH)) }),
    response: none,
  },
  load: {
    request: v.object({ slot: slotSchema }),
    response: v.object({ data: v.nullable(v.string()) }),
  },
  exit: { request: none, response: none },
  fullscreen: {
    request: v.object({ on: v.boolean() }),
    response: v.object({ on: v.boolean() }),
  },
} as const;

/** Events the host pushes to the game. */
export const events = {
  pause: none,
  resume: none,
} as const;

export type RequestType = keyof typeof requests;
export type EventType = keyof typeof events;
export type RequestPayload<T extends RequestType> = v.InferOutput<(typeof requests)[T]['request']>;
export type ResponsePayload<T extends RequestType> = v.InferOutput<
  (typeof requests)[T]['response']
>;

export function isRequestType(type: string): type is RequestType {
  return Object.hasOwn(requests, type);
}

export function isEventType(type: string): type is EventType {
  return Object.hasOwn(events, type);
}
