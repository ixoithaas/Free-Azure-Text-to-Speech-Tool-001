import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `ws` opens raw TCP sockets for the Edge read-aloud endpoint; keep it out of the
  // server bundle so Next never tries to polyfill Node networking primitives.
  serverExternalPackages: ["ws"],
};

export default nextConfig;
