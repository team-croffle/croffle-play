import * as v from 'valibot';

/** Why a v1 request failed. New codes may be added in minor releases; treat unknown as `internal`. */
export const errorCodes = [
  'unsupported',
  'invalid_request',
  'auth_required',
  'rate_limited',
  'timeout',
  'internal',
] as const;

export type ErrorCode = (typeof errorCodes)[number];

export const errorSchema = v.object({
  code: v.string(),
  message: v.pipe(v.string(), v.maxLength(500)),
});

export type ProtocolError = { code: ErrorCode | (string & {}); message: string };
