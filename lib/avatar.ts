/** Paletas fijas para Tailwind (evita purgar clases dinámicas). */
export const AVATAR_GRADIENTS = [
  "from-teal-500 to-emerald-700",
  "from-sky-500 to-blue-700",
  "from-violet-500 to-purple-700",
  "from-amber-500 to-orange-700",
  "from-rose-500 to-pink-700",
  "from-cyan-500 to-teal-700",
  "from-indigo-500 to-blue-800",
  "from-fuchsia-500 to-violet-700",
] as const;

export function avatarGradientClass(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h + seed.charCodeAt(i) * (i + 1)) % 997;
  }
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length]!;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}
