// Conservative URL normalization for SourceDocument dedup.
//
// Per P0001 §Source Dedup: "URL normalization 至少考虑 trim, normalize
// protocol/host casing where applicable, remove fragment, remove obvious
// trailing slash inconsistency. 不要做复杂 URL canonicalization framework.
// 不要主动联网跟 redirect."
//
// This is NOT a general-purpose URL canonicalizer. It only collapses
// the small set of surface-form differences that we know cause
// real-world accidental duplicates of the same source.

const ROOT_PATH = '/';

export function normalizeUrl(input: string): string {
  // Arrange: trim and parse.
  const trimmed = input.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch (cause) {
    throw new Error(`normalizeUrl: invalid URL: ${input}`, { cause });
  }

  // Act: apply the conservative rules.
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();
  url.hash = '';

  let pathname = url.pathname;
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }
  url.pathname = pathname;

  // Assert: serialise back to a string.
  return url.toString();
}

// Keep `ROOT_PATH` exported for tests that need to assert the
// "preserve the root path slash" rule explicitly.
export const NORMALIZED_ROOT_PATH = ROOT_PATH;
