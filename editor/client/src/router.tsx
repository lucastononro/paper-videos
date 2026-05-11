import React from 'react';

/**
 * Tiny hash-based router. We prefer hash over `pushState` so:
 *  - The Vite dev server doesn't need an SPA-fallback config.
 *  - Refreshing or sharing a URL works without server changes.
 *
 * Routes:
 *   #/                  → gallery
 *   #/edit/<slug>       → editor for slug
 *   #/new               → new project dialog (overlays gallery)
 */

export type Route = { kind: 'gallery' } | { kind: 'editor'; slug: string };

export function parseRoute(hash: string): Route {
  const h = hash.replace(/^#\/?/, '');
  if (h === '' || h === 'gallery') return { kind: 'gallery' };
  const editM = h.match(/^edit\/([^/?#]+)/);
  if (editM) return { kind: 'editor', slug: decodeURIComponent(editM[1]!) };
  return { kind: 'gallery' };
}

export function navigate(route: Route): void {
  const hash = (() => {
    switch (route.kind) {
      case 'gallery':
        return '#/';
      case 'editor':
        return `#/edit/${encodeURIComponent(route.slug)}`;
    }
  })();
  if (window.location.hash !== hash) {
    window.location.hash = hash;
  }
}

export function useRoute(): Route {
  const [route, setRoute] = React.useState<Route>(() => parseRoute(window.location.hash));
  React.useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
