"use client";

/** Logo estático en `public/branding/ferraria-logo.png` → `/branding/ferraria-logo.png` */

type BrandHeaderMarkProps = {
  /** `md` para login (48px), `sm` para barra del inbox (40px). */
  size?: "sm" | "md";
  className?: string;
};

export function BrandHeaderMark({ size = "sm", className = "" }: BrandHeaderMarkProps) {
  const box =
    size === "md"
      ? "h-12 w-12 rounded-2xl shadow-md shadow-[#c8a97e]/25"
      : "h-10 w-10 rounded-xl shadow-md shadow-[#c8a97e]/20";

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-white p-1 ring-1 ring-[#e7dfd4] ${box} ${className}`}
    >
      <img src="/branding/ferraria-logo.png" alt="FerrarIA" className="h-full w-full object-contain" />
    </div>
  );
}
