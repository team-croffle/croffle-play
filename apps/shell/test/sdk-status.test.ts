import { describe, expect, it } from 'vitest';

import { sdkNotice } from '../app/utils/sdk-status';

const sdk = (
  status: 'current' | 'lts' | 'maintenance' | 'deprecated' | 'eol',
  eolAt: string | null = null,
) => ({
  major: 1,
  status,
  deprecatedAt: null,
  eolAt,
});

describe('sdkNotice', () => {
  it('says nothing for supported majors (maintenance is for developers only)', () => {
    for (const s of ['current', 'lts', 'maintenance'] as const) {
      expect(sdkNotice(sdk(s))).toBeNull();
    }
  });

  it('warns players before end of life, with the date', () => {
    expect(sdkNotice(sdk('deprecated', '2027-03-01T00:00:00Z'))).toMatchObject({
      badge: '곧 지원 종료',
      playable: true,
      text: expect.stringContaining('2027'),
    });
  });

  it('blocks play after end of life or for unknown majors', () => {
    expect(sdkNotice(sdk('eol'))?.playable).toBe(false);
    expect(sdkNotice(null)?.playable).toBe(false);
  });
});
