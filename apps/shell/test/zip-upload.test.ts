import { describe, expect, it } from 'vitest';

import { zipUploadProblem } from '../server/utils/zip-upload';

describe('zipUploadProblem', () => {
  it('accepts an application/zip body within the limit', () => {
    expect(zipUploadProblem('application/zip', 10, 100)).toBeNull();
    expect(zipUploadProblem('application/zip; charset=binary', 10, 100)).toBeNull();
  });

  it('refuses other types, empty bodies and oversized zips', () => {
    expect(zipUploadProblem('application/json', 10, 100)).toMatch(/application\/zip/);
    expect(zipUploadProblem(undefined, 10, 100)).toMatch(/application\/zip/);
    expect(zipUploadProblem('application/zip', 0, 100)).toMatch(/empty/);
    expect(zipUploadProblem('application/zip', 101, 100)).toMatch(/larger than 100/);
  });
});
