import { describe, expect, it } from 'vitest';

import {
  clientMessageSchema,
  isRequestType,
  parseRoomsMessage,
  requiredCapability,
  serverMessageSchema,
} from '../src/index.js';

describe('rooms wire messages', () => {
  it('parses client messages', () => {
    expect(parseRoomsMessage(clientMessageSchema, '{"t":"auth","token":"x"}')).toEqual({
      t: 'auth',
      token: 'x',
    });
    expect(
      parseRoomsMessage(clientMessageSchema, '{"t":"join","room":"lobby-1","maxPeers":4}'),
    ).toMatchObject({
      t: 'join',
      room: 'lobby-1',
    });
    expect(
      parseRoomsMessage(clientMessageSchema, '{"t":"send","data":{"x":1},"to":"p2"}'),
    ).toMatchObject({ to: 'p2' });
  });

  it('rejects malformed frames', () => {
    for (const bad of [
      'not json',
      '{"t":"nope"}',
      '{"t":"join","room":"Bad Room"}',
      '{"t":"join","maxPeers":99}',
    ]) {
      expect(parseRoomsMessage(clientMessageSchema, bad)).toBeNull();
    }
  });

  it('parses server messages', () => {
    const peer = { id: 'c1', userId: 'u1', nickname: 'Kim' };
    expect(
      parseRoomsMessage(
        serverMessageSchema,
        JSON.stringify({ t: 'joined', room: 'r', peers: [peer], host: 'c1' }),
      ),
    ).not.toBeNull();
    expect(parseRoomsMessage(serverMessageSchema, '{"t":"msg","from":"c1","data":[1,2]}')).toEqual({
      t: 'msg',
      from: 'c1',
      data: [1, 2],
    });
  });

  it('adds token and rooms requests behind capabilities', () => {
    expect(isRequestType('getToken') && requiredCapability.getToken).toBe('token');
    expect(isRequestType('getRoomsUrl') && requiredCapability.getRoomsUrl).toBe('rooms');
  });
});
