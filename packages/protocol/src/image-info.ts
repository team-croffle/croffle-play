/** Pure header parsing, shared by play-cli (thumbnails) and the API (avatars). */
/** Format and pixel size from an image's header (PNG, JPEG, WebP), or null when unrecognised. */
export function imageInfo(
  b: Uint8Array,
): { format: 'png' | 'jpeg' | 'webp'; width: number; height: number } | null {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const ascii = (at: number, len: number) => String.fromCharCode(...b.subarray(at, at + len));
  // PNG: signature, then the IHDR chunk carries width and height.
  if (b.length >= 24 && b[0] === 0x89 && ascii(1, 3) === 'PNG' && ascii(12, 4) === 'IHDR') {
    return { format: 'png', width: view.getUint32(16), height: view.getUint32(20) };
  }
  // JPEG: walk the segments to the first start-of-frame marker.
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        return null;
      }
      const marker = b[i + 1] ?? 0;
      const length = view.getUint16(i + 2);
      const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isSof) {
        return { format: 'jpeg', height: view.getUint16(i + 5), width: view.getUint16(i + 7) };
      }
      i += 2 + length;
    }
    return null;
  }
  // WebP: RIFF container with a VP8 (lossy), VP8L (lossless), or VP8X (extended) chunk.
  if (b.length >= 30 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    const chunk = ascii(12, 4);
    if (chunk === 'VP8 ') {
      return {
        format: 'webp',
        width: view.getUint16(26, true) & 0x3fff,
        height: view.getUint16(28, true) & 0x3fff,
      };
    }
    if (chunk === 'VP8L') {
      const bits = view.getUint32(21, true);
      return { format: 'webp', width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === 'VP8X') {
      const w = (b[24] ?? 0) | ((b[25] ?? 0) << 8) | ((b[26] ?? 0) << 16);
      const h = (b[27] ?? 0) | ((b[28] ?? 0) << 8) | ((b[29] ?? 0) << 16);
      return { format: 'webp', width: w + 1, height: h + 1 };
    }
  }
  return null;
}
