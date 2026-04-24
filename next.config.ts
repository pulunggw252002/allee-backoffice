import type { NextConfig } from "next";

const remoteHostnames = (
  process.env.NEXT_PUBLIC_IMAGE_REMOTE_HOSTS ?? "images.unsplash.com"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: remoteHostnames.map((hostname) => ({
      protocol: "https" as const,
      hostname,
    })),
  },
};

export default nextConfig;
