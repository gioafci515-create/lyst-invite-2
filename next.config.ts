import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
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
      ["/participate", "/tasks"],
      ["/guestbook", "/voice"],
      ["/later", "/letter"],
      ["/interact", "/live"],
      ["/remember", "/live"],
      ["/notifications", "/updates"],
    ].map(([source, destination]) => ({ source, destination, permanent: false }));
  },
};

export default nextConfig;
