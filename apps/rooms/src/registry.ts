import { randomBytes } from 'node:crypto';

import { type Peer, ROOMS, type ServerMessage } from '@croffledev/play-protocol';

/** One connected, authenticated client. */
export interface Member {
  peer: Peer;
  gameId: string;
  room: Room | null;
  send(message: ServerMessage): void;
}

export interface Room {
  /** `<gameId>:<roomId>`: games never share rooms. */
  key: string;
  id: string;
  maxPeers: number;
  members: Map<string, Member>;
  hostId: string;
}

export type JoinError = 'already_in_room' | 'room_full';

/**
 * In-memory rooms (single instance; rooms vanish on restart and clients re-create them when
 * they rejoin). The host is the longest-present member.
 */
export class RoomRegistry {
  private readonly rooms = new Map<string, Room>();

  get size(): number {
    return this.rooms.size;
  }

  join(m: Member, roomId: string | undefined, maxPeers?: number): Room | JoinError {
    if (m.room) {
      return 'already_in_room';
    }
    const id =
      roomId ??
      randomBytes(6)
        .toString('base64url')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, 'x');
    const key = `${m.gameId}:${id}`;
    let room = this.rooms.get(key);
    if (!room) {
      room = {
        key,
        id,
        maxPeers: maxPeers ?? ROOMS.defaultMaxPeers,
        members: new Map(),
        hostId: m.peer.id,
      };
      this.rooms.set(key, room);
    }
    if (room.members.size >= room.maxPeers) {
      return 'room_full';
    }
    for (const other of room.members.values()) {
      other.send({ t: 'peer-join', peer: m.peer });
    }
    room.members.set(m.peer.id, m);
    m.room = room;
    m.send({
      t: 'joined',
      room: room.id,
      peers: [...room.members.values()].map((x) => x.peer),
      host: room.hostId,
    });
    return room;
  }

  leave(m: Member): void {
    const room = m.room;
    if (!room) {
      return;
    }
    room.members.delete(m.peer.id);
    m.room = null;
    if (room.members.size === 0) {
      this.rooms.delete(room.key);
      return;
    }
    for (const other of room.members.values()) {
      other.send({ t: 'peer-leave', peerId: m.peer.id });
    }
    if (room.hostId === m.peer.id) {
      // Map keeps insertion order: the first remaining member has been here longest.
      room.hostId = room.members.keys().next().value as string;
      for (const other of room.members.values()) {
        other.send({ t: 'host', peerId: room.hostId });
      }
    }
  }

  /** Relays to everyone else in the room, or to one member. False when `to` is not there. */
  relay(from: Member, data: unknown, to?: string): boolean {
    const room = from.room;
    if (!room) {
      return false;
    }
    const message: ServerMessage = { t: 'msg', from: from.peer.id, data };
    if (to !== undefined) {
      const target = room.members.get(to);
      target?.send(message);
      return target !== undefined;
    }
    for (const other of room.members.values()) {
      if (other !== from) {
        other.send(message);
      }
    }
    return true;
  }
}
