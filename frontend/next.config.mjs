/** @type {import('next').NextConfig} */
const nextConfig = {
  agentRules: false,
  // Smaller production image for Docker.
  output: "standalone",
  // Allow both localhost and 127.0.0.1 in dev so CSS/JS chunks load.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "127.0.0.1", port: "8000", pathname: "/media/**" },
      { protocol: "http", hostname: "localhost", port: "8000", pathname: "/media/**" },
      { protocol: "http", hostname: "localhost", pathname: "/media/**" },
      { protocol: "https", hostname: "**", pathname: "/media/**" },
    ],
  },
};

export default nextConfig;
