import type { SVGProps } from "react";

/** Ikon play YouTube generik (lucide tidak lagi menyertakan logo brand). */
export function SiYoutube(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="5" width="20" height="14" rx="4" />
      <path d="M10 9.5v5l4.5-2.5z" />
    </svg>
  );
}
