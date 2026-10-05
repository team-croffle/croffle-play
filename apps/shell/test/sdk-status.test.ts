import { describe, expect, it } from 'vitest';

import { sdkNotice } from '../app/utils/sdk-status';

const sdk = (status: 'current' | 'lts' | 'old' | 'deprecated') => ({
  major: 1,
  status,
  oldAt: null,
  deprecatedAt: null,
});

describe('sdkNotice', () => {
  it('says nothing to players while the major still runs (old is for developers only)', () => {
    for (const s of ['current', 'lts', 'old'] as const) {
      expect(sdkNotice(sdk(s))).toBeNull();
    }
  });

  it('marks deprecated games as not updated and not playable', () => {
    expect(sdkNotice(sdk('deprecated'))).toMatchObject({
      badge: '업데이트되지 않음',
      playable: false,
    });
  });

  it('blocks play for unknown majors', () => {
    expect(sdkNotice(null)?.playable).toBe(false);
  });
});
