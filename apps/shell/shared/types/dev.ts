export interface MyGame {
  id: string;
  name: string;
  role: 'owner' | 'developer';
  stableVersion: string | null;
  previewVersion: string | null;
  latest: { version: string; status: string; sdkMajor: number; uploadedAt: string | null } | null;
  sdk: { major: number; status: string; eolAt: string | null } | null;
  warnings: string[];
}
