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
  Logout: (
    <>
      <path d="M7 17H5a1.5 1.5 0 0 1-1.5-1.5v-11A1.5 1.5 0 0 1 5 3h2" />
      <path d="M13 14l3-3-3-3" />
      <path d="M16 11H7" />
    </>
  ),
  MedicationLiquid: (
    <>
      <rect x="7" y="2" width="6" height="4" rx="1" />
      <rect x="5.5" y="6" width="9" height="12" rx="1.5" />
      <path d="M8 10h4" />
      <path d="M10 8v4" />
    </>
  ),
  Notifications: (
    <>
      <path d="M10 17.5a2 2 0 0 1-2-2h4a2 2 0 0 1-2 2z" />
      <path d="M16 12.5V8a6 6 0 0 0-5-5.91A1 1 0 0 0 10 3a1 1 0 0 0-1 .09A6 6 0 0 0 4 8v4.5l-1 2h14l-1-2z" />
    </>
  ),
  Warning: (
    <>
      <path d="M10 2L1.5 17.5h17L10 2z" />
      <path d="M10 8v4" />
      <circle cx="10" cy="14" r="0.5" fill="currentColor" stroke="none" />
    </>
  ),
  Info: (
    <>
      <circle cx="10" cy="10" r="8" />
      <path d="M10 9v5" />
      <circle cx="10" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
    </>
  ),
  Healing: (
    <>
      <path d="M5 8.5C5 6 7 4 9.5 4H10V2.5A1.5 1.5 0 0 0 8.5 1h-3A1.5 1.5 0 0 0 4 2.5v3A1.5 1.5 0 0 0 5.5 7H7v1.5z" />
      <path d="M15 8.5C15 6 13 4 10.5 4H10V2.5A1.5 1.5 0 0 1 11.5 1h3A1.5 1.5 0 0 1 16 2.5v3A1.5 1.5 0 0 1 14.5 7H13v1.5z" />
      <path d="M5 11.5C5 14 7 16 9.5 16H10v1.5A1.5 1.5 0 0 0 11.5 19h3a1.5 1.5 0 0 0 1.5-1.5v-3A1.5 1.5 0 0 0 14.5 13H13v-1.5z" />
      <path d="M15 11.5C15 14 13 16 10.5 16H10v1.5A1.5 1.5 0 0 1 8.5 19h-3A1.5 1.5 0 0 1 4 17.5v-3A1.5 1.5 0 0 1 5.5 13H7v-1.5z" />
    </>
  ),
  Emergency: (
    <>
      <path d="M10 2v16" />
      <path d="M2 10h16" />
      <path d="M4.22 4.22l11.56 11.56" />
      <path d="M15.78 4.22L4.22 15.78" />
    </>
  ),
  Biotech: (
    <>
      <path d="M9 3h2v5.5l-4 7.5h8l-4-7.5V3z" />
      <path d="M7 16h6" />
      <circle cx="10" cy="11" r="1" />
    </>
  ),
  Science: (
    <>
      <path d="M8 2h4v6l4 8.5a1.5 1.5 0 0 1-1.3 2.2H5.3A1.5 1.5 0 0 1 4 16.5L8 8V2z" />
      <path d="M7 2h6" />
      <path d="M9 13h2" />
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
