export interface UiConfig {
  primaryColor: string;
  accentColor: string;
}

let currentLogoUrl: string | null = null;
let logoObjectUrl: string | null = null;
const logoListeners = new Set<() => void>();

export function getLogoUrl(): string | null {
  return currentLogoUrl;
}

export function subscribeLogo(listener: () => void): () => void {
  logoListeners.add(listener);
  return () => {
    logoListeners.delete(listener);
  };
}

function setLogoUrl(url: string | null): void {
  if (url === currentLogoUrl) return;
  currentLogoUrl = url;
  logoListeners.forEach((listener) => listener());
}

export async function loadLogoUrl(): Promise<string | null> {
  try {
    const res = await fetch('/api/config/logo', { cache: 'no-store' });
    if (!res.ok) throw new Error(`Unexpected status ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    if (logoObjectUrl) URL.revokeObjectURL(logoObjectUrl);
    logoObjectUrl = url;
    setLogoUrl(url);
    return url;
  } catch {
    setLogoUrl(null);
    return null;
  }
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

const DEFAULT_PRIMARY = '#0f766e';
const DEFAULT_ACCENT = '#115e59';
const STORAGE_KEY = 'app-config';

function normalize(data: Record<string, unknown>): UiConfig | null {
  const primaryColor = isHexColor(data.primaryColor) ? data.primaryColor : null;
  const accentColor = isHexColor(data.accentColor) ? data.accentColor : null;
  if (!primaryColor && !accentColor) return null;
  return {
    primaryColor: primaryColor ?? DEFAULT_PRIMARY,
    accentColor: accentColor ?? DEFAULT_ACCENT,
  };
}

function readCached(): UiConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalize(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    return null;
  }
}

function writeCache(config: UiConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage access errors.
  }
}

export async function loadUiConfig(): Promise<UiConfig | null> {
  const cached = readCached();
  try {
    const res = await fetch('/api/config', { cache: 'no-store' });
    if (!res.ok) return cached;
    const data: unknown = await res.json();
    if (typeof data !== 'object' || data === null) return cached;
    const config = normalize(data as Record<string, unknown>);
    if (!config) return cached;
    writeCache(config);
    return config;
  } catch {
    return cached;
  }
}

export function applyCachedUiConfig(): void {
  const cached = readCached();
  if (cached) applyUiConfig(cached);
}

export function applyUiConfig(config: UiConfig): void {
  const root = document.documentElement;
  root.style.setProperty('--accent', config.primaryColor);
  root.style.setProperty('--accent-dark', config.accentColor);
  const rgb = parseHex(config.primaryColor);
  if (rgb) {
    root.style.setProperty('--accent-soft', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`);
    root.style.setProperty('--accent-faint', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.06)`);
    root.style.setProperty('--accent-ring', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`);
  }
}

export function watchUiConfig(): void {
  let refreshing = false;
  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    try {
      const config = await loadUiConfig();
      if (config) applyUiConfig(config);
    } finally {
      refreshing = false;
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refresh();
  });
  window.addEventListener('focus', () => void refresh());
}

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

function parseHex(value: string): Rgb | null {
  const match = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;
  let hex = match[1];
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const num = parseInt(hex, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}
