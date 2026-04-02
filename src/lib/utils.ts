import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Generate a consistent, aesthetic color for a username
const AVATAR_COLORS = [
  "text-emerald-400 bg-emerald-400/10",
  "text-amber-400 bg-amber-400/10",
  "text-rose-400 bg-rose-400/10",
  "text-cyan-400 bg-cyan-400/10",
  "text-indigo-400 bg-indigo-400/10",
  "text-fuchsia-400 bg-fuchsia-400/10",
  "text-violet-400 bg-violet-400/10",
  "text-orange-400 bg-orange-400/10",
];

export function getUsernameColorClasses(username: string) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

export function getInitials(name: string) {
  return name.substring(0, 2).toUpperCase();
}
