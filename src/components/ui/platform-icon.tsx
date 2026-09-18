import type { SocialPlatform } from "@/domain/social";

// Representações provisórias do modo demonstração.
// O sprint visual substituirá estes monogramas pelos assets de marca permitidos por cada plataforma.
const monograms: Record<SocialPlatform, string> = { instagram: "Ig", facebook: "f", tiktok: "Tk", youtube: "▶", linkedin: "in", x: "X", kwai: "Kw" };
const colors: Record<SocialPlatform, string> = { instagram: "bg-fuchsia-100 text-fuchsia-700", facebook: "bg-blue-100 text-blue-700", tiktok: "bg-slate-900 text-white", youtube: "bg-red-100 text-red-700", linkedin: "bg-sky-100 text-sky-800", x: "bg-neutral-200 text-neutral-900", kwai: "bg-orange-100 text-orange-700" };
export function PlatformIcon({ platform, small = false }: { platform: SocialPlatform; small?: boolean }) { return <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-lg font-bold ${small ? "h-7 w-7 text-[10px]" : "h-10 w-10 text-xs"} ${colors[platform]}`}>{monograms[platform]}</span>; }
