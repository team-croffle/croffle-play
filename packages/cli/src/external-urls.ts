/**
 * Finds references to resources outside the bundle (design invariant 3: bundles are
 * self-contained; the game domain's CSP blocks them anyway). Heuristic, tuned for few false
 * positives: links (`<a href>`) and plain strings in scripts are not reported.
 */
const absolute = String.raw`(?:https?:)?\/\/`;

const patterns: Record<'html' | 'css' | 'js', RegExp[]> = {
  html: [
    new RegExp(
      String.raw`<(?:script|link|img|iframe|audio|video|source|embed|object|track|image|input)\b[^>]*?\s(?:src|href|data|poster|srcset)\s*=\s*["']?${absolute}[^"'\s>]+`,
      'gi',
    ),
    new RegExp(String.raw`url\(\s*["']?${absolute}[^)"']+`, 'gi'),
  ],
  css: [
    new RegExp(String.raw`url\(\s*["']?${absolute}[^)"']+`, 'gi'),
    new RegExp(String.raw`@import\s+(?:url\()?\s*["']?${absolute}[^"');\s]+`, 'gi'),
  ],
  js: [
    new RegExp(String.raw`\bimport\s*\(\s*["'\`]${absolute}[^"'\`]+`, 'g'),
    new RegExp(String.raw`\bfrom\s*["']${absolute}[^"']+`, 'g'),
    new RegExp(String.raw`\bimportScripts\s*\(\s*["']${absolute}[^"']+`, 'g'),
  ],
};

export function kindOf(path: string): keyof typeof patterns | null {
  if (/\.html?$/i.test(path)) {
    return 'html';
  }
  if (/\.css$/i.test(path)) {
    return 'css';
  }
  return /\.m?js$/i.test(path) ? 'js' : null;
}

/** Offending snippets in one text file (empty when clean). */
export function findExternalUrls(kind: keyof typeof patterns, text: string): string[] {
  const found = new Set<string>();
  for (const re of patterns[kind]) {
    for (const m of text.matchAll(re)) {
      found.add(m[0].slice(0, 120));
    }
  }
  return [...found];
}
