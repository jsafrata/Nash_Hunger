"use client";

export function Logo({ size = 48 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-label="Nash Hunger"
    >
      <path
        d="M 50 6 L 94 50 L 50 94 L 6 50 Z"
        fill="none"
        stroke="#f5b914"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M 50 18 L 82 50 L 18 50 Z" fill="#34d399" opacity="0.9" />
      <path d="M 50 82 L 18 50 L 82 50 Z" fill="#f87171" opacity="0.9" />
      <line x1="22" y1="50" x2="78" y2="50" stroke="#0a0c11" strokeWidth="2" />
    </svg>
  );
}
