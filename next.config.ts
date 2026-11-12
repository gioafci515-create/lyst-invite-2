import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // photographs are served at 90 (crisper type in the event photos); everything else keeps the default 75
  images: { qualities: [75, 90] },
  partialPrefetching: true,
  experimental: {
    agentUpgrade: "security",
  },
  // Older addresses for screens that now have their own routes. (Old in-page links like /#voice are forwarded by the
  // home page itself, because the part after # never reaches the server.)
  async redirects() {
    return [
      ["/hub", "/programme"],
      ["/prepare", "/programme"],
      ["/respond", "/details"],
      ["/participate", "/moments"],
      ["/tasks", "/moments"],
      ["/guestbook", "/voice"],
      ["/later", "/for-later"],
      // the letter lives in the live room again (its own rule: the hosts read it at once); the capsule has its own screen
      ["/letter", "/live"],
      ["/interact", "/live"],
      ["/remember", "/live"],
      ["/notifications", "/updates"],
    ].map(([source, destination]) => ({ source, destination, permanent: false }));
  },
};

export default nextConfig;
