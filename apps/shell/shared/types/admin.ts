export interface AdminGame {
  id: string;
  name: string;
  description: string;
  stableVersion: string | null;
  previewVersion: string | null;
  maxBundleBytes: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminVersion {
  version: string;
  status: 'pending' | 'uploaded' | 'approved' | 'rejected';
  sdkMajor: number;
  uploadedAt: string | null;
  createdAt: string;
}

export interface DeployKeyView {
  id: string;
  prefix: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}
