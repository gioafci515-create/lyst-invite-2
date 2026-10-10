import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // old per-screen routes now live as sections of the home page
  async redirects() {
    return [
      ["/hub", "hub"],
      ["/respond", "details"],
      ["/prepare", "hub"],
      ["/camera", "camera"],
      ["/participate", "camera"],
      ["/guestbook", "voice"],
      ["/video", "video"],
      ["/later", "later"],
      ["/interact", "live"],
      ["/remember", "live"],
      ["/gallery", "gallery"],
      ["/capsule", "capsule"],
      ["/notifications", "updates"],
    ].map(([source, id]) => ({ source, destination: `/#${id}`, permanent: false }));
  },
};

export default nextConfig;
