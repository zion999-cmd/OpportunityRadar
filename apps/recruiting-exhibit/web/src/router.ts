// Minimal history router — no routing library (task.md:
// "不要做复杂 router 行为"). Three routes total:
//   /                magazine home
//   /meaning/:id     one recovered meaning detail
//   /radar           observation radar / sources (the old feed)

import { useSyncExternalStore } from 'react';

export type Route =
  | { readonly name: 'home' }
  | { readonly name: 'meaning'; readonly id: string }
  | { readonly name: 'radar' };

export function parseRoute(pathname: string): Route {
  const parts = pathname.split('/').filter((p) => p.length > 0);
  if (parts.length === 0) return { name: 'home' };
  if (parts[0] === 'radar') return { name: 'radar' };
  if (parts[0] === 'meaning' && parts.length >= 2 && parts[1] !== undefined) {
    return { name: 'meaning', id: decodeURIComponent(parts[1]) };
  }
  return { name: 'home' };
}

export function navigate(path: string): void {
  if (path === window.location.pathname) return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0 });
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange);
  return () => window.removeEventListener('popstate', onChange);
}

export function useRoute(): Route {
  const pathname = useSyncExternalStore(
    subscribe,
    () => window.location.pathname,
    () => '/',
  );
  return parseRoute(pathname);
}
