import * as v from 'valibot';

import { errorSchema, type ProtocolError } from './errors.js';

/** Marks Croffle Play messages among whatever else is posted to the window. */
export const NAMESPACE = 'croffle-play';
export const VERSION = 1;

const base = { ns: v.literal(NAMESPACE), v: v.literal(VERSION) };
const idSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(64));
const typeSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(64));

export const requestEnvelopeSchema = v.object({
  ...base,
  kind: v.literal('req'),
  id: idSchema,
  type: typeSchema,
  payload: v.optional(v.unknown()),
});

export const responseEnvelopeSchema = v.variant('ok', [
  v.object({
    ...base,
    kind: v.literal('res'),
    id: idSchema,
    ok: v.literal(true),
    payload: v.optional(v.unknown()),
  }),
  v.object({
    ...base,
    kind: v.literal('res'),
    id: idSchema,
    ok: v.literal(false),
    error: errorSchema,
  }),
]);

export const eventEnvelopeSchema = v.object({
  ...base,
  kind: v.literal('evt'),
  type: typeSchema,
  payload: v.optional(v.unknown()),
});

export const envelopeSchema = v.variant('kind', [
  requestEnvelopeSchema,
  responseEnvelopeSchema,
  eventEnvelopeSchema,
]);

export type RequestEnvelope = v.InferOutput<typeof requestEnvelopeSchema>;
export type ResponseEnvelope = v.InferOutput<typeof responseEnvelopeSchema>;
export type EventEnvelope = v.InferOutput<typeof eventEnvelopeSchema>;
export type Envelope = v.InferOutput<typeof envelopeSchema>;

/** Parses any v1 envelope; null for foreign or malformed messages. */
export function parseEnvelope(input: unknown): Envelope | null {
  const r = v.safeParse(envelopeSchema, input);
  return r.success ? r.output : null;
}

export function request(id: string, type: string, payload?: unknown): RequestEnvelope {
  return { ns: NAMESPACE, v: VERSION, kind: 'req', id, type, payload };
}

export function ok(id: string, payload?: unknown): ResponseEnvelope {
  return { ns: NAMESPACE, v: VERSION, kind: 'res', id, ok: true, payload };
}

export function fail(id: string, error: ProtocolError): ResponseEnvelope {
  return { ns: NAMESPACE, v: VERSION, kind: 'res', id, ok: false, error };
}

export function event(type: string, payload?: unknown): EventEnvelope {
  return { ns: NAMESPACE, v: VERSION, kind: 'evt', type, payload };
}
