import { isValidGameId } from '@croffledev/play-protocol';
import { describe, expect, it } from 'vitest';

// The shell's server routes reject these before calling the API (server/utils/game-id.ts).
describe('shell game id guard', () => {
  it.each(['www', 'api', 'static', 'Tetris', 'a_b', '../x'])('refuses %s', (id) => {
    expect(isValidGameId(id)).toBe(false);
  });
});
