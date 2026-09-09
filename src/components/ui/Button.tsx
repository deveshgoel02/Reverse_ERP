import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";

const BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none px-3.5 py-2";

const VARIANTS = {
  primary: "bg-primary text-white hover:bg-[var(--primary-hover)]",
  secondary: "bg-surface border border-border text-text hover:bg-bg",
  danger: "bg-[var(--status-critical-bg)] text-[var(--status-critical-text)] hover:opacity-80",
  ghost: "text-text-muted hover:text-text hover:bg-bg",
};

type Variant = keyof typeof VARIANTS;

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />;
}

export function LinkButton({
  href,
  variant = "secondary",
  className = "",
  children,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={`${BASE} ${VARIANTS[variant]} ${className}`}>
      {children}
    </Link>
  );
}
