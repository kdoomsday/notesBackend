interface BackLinkProps {
  label: string;
  onClick: () => void;
}

export default function BackLink({ label, onClick }: BackLinkProps) {
  return (
    <button type="button" className="back-link" onClick={onClick}>
      <svg
        width="16"
        height="16"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M15 10H5" />
        <path d="M9 5l-5 5 5 5" />
      </svg>
      {label}
    </button>
  );
}
