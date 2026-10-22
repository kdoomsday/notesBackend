import { useCallback, useEffect, useMemo, useState } from 'react';

export const SECTIONS = ['patients', 'categories', 'operators', 'users', 'roles'] as const;

export type Section = (typeof SECTIONS)[number];

export type Route =
  | { kind: 'section'; section: Section }
  | { kind: 'patient'; patientId: string }
  | { kind: 'shift'; patientId: string; shiftId: string };

function isSection(value: string): value is Section {
  return (SECTIONS as readonly string[]).includes(value);
}

function decodePart(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function sectionOf(route: Route): Section {
  return route.kind === 'section' ? route.section : 'patients';
}

export function parseHash(hash: string): Route | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const path = raw.startsWith('/') ? raw.slice(1) : raw;
  if (!path) return null;
  const parts = path.split('/');
  if (parts.length === 1) {
    return isSection(parts[0]) ? { kind: 'section', section: parts[0] } : null;
  }
  if (parts[0] !== 'patients') return null;
  if (parts.length === 2 && parts[1]) {
    return { kind: 'patient', patientId: decodePart(parts[1]) };
  }
  if (parts.length === 4 && parts[2] === 'shifts' && parts[1] && parts[3]) {
    return {
      kind: 'shift',
      patientId: decodePart(parts[1]),
      shiftId: decodePart(parts[3]),
    };
  }
  return null;
}

export function routeToHash(route: Route): string {
  if (route.kind === 'section') return `#/${route.section}`;
  if (route.kind === 'patient') {
    return `#/patients/${encodeURIComponent(route.patientId)}`;
  }
  return `#/patients/${encodeURIComponent(route.patientId)}/shifts/${encodeURIComponent(route.shiftId)}`;
}

function currentHash(): string {
  return window.location.hash;
}

export function useHashRoute(): {
  route: Route | null;
  navigate: (route: Route, options?: { replace?: boolean }) => void;
} {
  const [hash, setHash] = useState(currentHash);

  useEffect(() => {
    function sync() {
      setHash(currentHash());
    }
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);

  const navigate = useCallback((nextRoute: Route, options: { replace?: boolean } = {}) => {
    const next = routeToHash(nextRoute);
    if (next === currentHash()) {
      setHash(next);
      return;
    }
    if (options.replace) {
      window.history.replaceState(null, '', next);
    } else {
      window.history.pushState(null, '', next);
    }
    setHash(next);
  }, []);

  const route = useMemo(() => parseHash(hash), [hash]);

  return { route, navigate };
}
