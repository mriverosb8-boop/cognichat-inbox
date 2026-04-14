/** Paletas fijas para Tailwind (evita purgar clases dinámicas). Tonos suaves acordes a UI clara. */
export const AVATAR_GRADIENTS = [
  "from-[#b5a896] to-[#8f8274]",
  "from-[#a8b0b8] to-[#7d858f]",
  "from-[#c4b8a8] to-[#9a8f82]",
  "from-[#b8a99a] to-[#8c7f72]",
  "from-[#a3aeb8] to-[#76808a]",
  "from-[#c8a97e] to-[#9e8560]",
  "from-[#9eb0c4] to-[#6f7d8f]",
  "from-[#b9ada3] to-[#8a8078]",
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
