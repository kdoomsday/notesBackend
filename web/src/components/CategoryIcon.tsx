import type { ReactNode } from 'react';

interface CategoryIconProps {
  iconName?: string | null;
  size?: number;
}

const ICONS: Record<string, ReactNode> = {
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
  Pulse: <path d="M1.5 10h3.5l2-5 3 10 2-5h3.5" />,
  Temperature: (
    <>
      <path d="M10 2.5v7" />
      <circle cx="10" cy="13.5" r="3" />
    </>
  ),
  Heart: <path d="M10 16.5 4.6 11a3.4 3.4 0 1 1 4.8-4.8l.6.6.6-.6A3.4 3.4 0 0 1 15.4 11z" />,
  Clipboard: (
    <>
      <rect x="5" y="3" width="10" height="14" rx="1.5" />
      <path d="M7.5 8h5" />
      <path d="M7.5 11h5" />
    </>
  ),
  Document: (
    <>
      <path d="M6 2.75A.75.75 0 0 1 6.75 2h4.5L15 5.5v11.75a.75.75 0 0 1-.75.75h-7.5a.75.75 0 0 1-.75-.75z" />
      <path d="M11 2.5V6h3.5" />
    </>
  ),
};

export default function CategoryIcon({ iconName, size = 16 }: CategoryIconProps) {
  const base = (iconName ?? '').replace(/^(Filled|Regular|Outline)\./, '');
  const icon = ICONS[base] ?? ICONS.Document;

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
