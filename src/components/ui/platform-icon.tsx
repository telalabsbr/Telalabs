import type { SocialPlatform } from "@/domain/social";

const iconUrls: Record<SocialPlatform, string> = {
  instagram: "/brands/instagram.svg",
  facebook: "/brands/facebook.svg",
  tiktok: "/brands/tiktok.svg",
  youtube: "/brands/youtube.svg",
  linkedin: "/brands/linkedin.svg",
  x: "/brands/x.svg",
  kwai: "/brands/kwai.svg",
};

export function PlatformIcon({ platform, small = false }: { platform: SocialPlatform; small?: boolean }) {
  const size = small ? 24 : 36;
  return <span
    aria-hidden
    className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-white ${small ? "h-7 w-7" : "h-10 w-10"}`}
  >
    <img
      src={iconUrls[platform]}
      alt=""
      width={size}
      height={size}
      className={small ? "h-5 w-5 object-contain" : "h-7 w-7 object-contain"}
    />
  </span>;
}
