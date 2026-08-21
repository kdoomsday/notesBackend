import type { ReactNode } from 'react';
import { CATEGORY_ICON_NAMES } from './categoryIconNames';

export { CATEGORY_ICON_NAMES };

interface CategoryIconProps {
  iconName?: string | null;
  size?: number;
}

export const DEFAULT_CATEGORY_ICON_NAME = 'Filled.Description';

const ICON_PREFIX = /^(Filled|Regular|Outline)\./;

const BASE_ICON_NAMES = new Set(CATEGORY_ICON_NAMES.map((name) => name.split('.')[1]));

const ICONS: Record<string, ReactNode> = {
  Assignment: (
    <>
      <rect x="5" y="3" width="10" height="14" rx="1.5" />
      <path d="M7.5 8h5" />
      <path d="M7.5 11h5" />
      <path d="M8.5 3.5a1.5 1.5 0 0 1 3 0" />
    </>
  ),
  Bloodtype: (
    <>
      <path d="M10 2.5s5 5.6 5 9a5 5 0 0 1-10 0c0-3.4 5-9 5-9z" />
      <path d="M10 9v4" />
      <path d="M8 11h4" />
    </>
  ),
  Description: (
    <>
      <path d="M6 2.75A.75.75 0 0 1 6.75 2h4.5L15 5.5v11.75a.75.75 0 0 1-.75.75h-7.5a.75.75 0 0 1-.75-.75z" />
      <path d="M11 2.5V6h3.5" />
    </>
  ),
  Favorite: <path d="M10 16.5 4.6 11a3.4 3.4 0 1 1 4.8-4.8l.6.6.6-.6A3.4 3.4 0 0 1 15.4 11z" />,
  MedicalServices: (
    <>
      <rect x="3" y="6" width="14" height="10" rx="1.5" />
      <path d="M8 6V4.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V6" />
      <path d="M10 9v4" />
      <path d="M8 11h4" />
    </>
  ),
  Medication: (
    <>
      <rect x="7" y="3.5" width="6" height="3" rx="0.75" />
      <rect x="5.5" y="6.5" width="9" height="10" rx="1.5" />
      <path d="M8 11h4" />
    </>
  ),
  MonitorHeart: (
    <>
      <rect x="2.5" y="4" width="15" height="10.5" rx="1.5" />
      <path d="M5 9.25h2.5L9 6.75l2 4.5 1.5-2h2.5" />
      <path d="M7 17.5h6" />
      <path d="M10 14.5v3" />
    </>
  ),
  Scale: (
    <>
      <path d="M10 4v13" />
      <path d="M3 6h14" />
      <path d="M3 6l-1.8 4.5" />
      <path d="M.5 11.5h3.5" />
      <path d="M17 6l1.8 4.5" />
      <path d="M16 11.5h3.5" />
      <path d="M7 17h6" />
    </>
  ),
  Straighten: (
    <>
      <rect x="2" y="7.5" width="16" height="5" rx="1" />
      <path d="M5 7.5v2" />
      <path d="M8 7.5v2" />
      <path d="M11 7.5v2" />
      <path d="M14 7.5v2" />
    </>
  ),
  Thermostat: (
    <>
      <path d="M10 2.5v7" />
      <circle cx="10" cy="13.5" r="3" />
    </>
  ),
  Vaccines: (
    <>
      <g transform="rotate(-45 10 10)">
        <rect x="6.5" y="7.5" width="7" height="5" rx="1" />
        <path d="M13.5 10h3" />
        <path d="M3.5 10h3" />
        <path d="M3.5 8.5v3" />
      </g>
    </>
  ),
};

export function resolveCategoryIconName(iconName?: string | null): string {
  const base = (iconName ?? '').replace(ICON_PREFIX, '');
  return BASE_ICON_NAMES.has(base) ? `Filled.${base}` : DEFAULT_CATEGORY_ICON_NAME;
}

export default function CategoryIcon({ iconName, size = 16 }: CategoryIconProps) {
  const icon = ICONS[resolveCategoryIconName(iconName).split('.')[1]] ?? ICONS.Document;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icon}
    </svg>
  );
}
