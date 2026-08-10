/** @type {import('next').NextConfig} */
const nextConfig = {
  agentRules: false,
  // Allow both localhost and 127.0.0.1 in dev so CSS/JS chunks load.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "127.0.0.1", port: "8000", pathname: "/media/**" },
      { protocol: "http", hostname: "localhost", port: "8000", pathname: "/media/**" },
    ],
  },
};

export default nextConfig;
