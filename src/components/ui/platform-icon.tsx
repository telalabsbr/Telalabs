import type { SocialPlatform } from "@/domain/social";

const iconUrls: Record<SocialPlatform, string> = {
  instagram: "https://cdn.simpleicons.org/instagram/E4405F",
  facebook: "https://cdn.simpleicons.org/facebook/1877F2",
  tiktok: "https://cdn.simpleicons.org/tiktok/000000",
  youtube: "https://cdn.simpleicons.org/youtube/FF0000",
  linkedin: "https://cdn.simpleicons.org/linkedin/0A66C2",
  x: "https://cdn.simpleicons.org/x/000000",
  kwai: "https://cdn.simpleicons.org/kwai/FF4906",
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
      loading="lazy"
    />
  </span>;
}
