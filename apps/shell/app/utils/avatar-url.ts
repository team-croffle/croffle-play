/**
 * Avatars uploaded to the platform are portal paths (`/avatars/…`); games run on other origins, so
 * they get absolute URLs. IdP pictures are already absolute.
 */
export function absoluteAvatar(avatar: string | null, origin: string): string | null {
  return avatar?.startsWith('/') ? new URL(avatar, origin).href : avatar;
}
