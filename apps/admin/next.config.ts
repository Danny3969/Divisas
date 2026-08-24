import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.trycloudflare.com", "localhost", "127.0.0.1", "192.168.100.166"],
};

export default nextConfig;
