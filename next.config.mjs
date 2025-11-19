/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "storage.shngm.id",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "delivery.shngm.id",
      },
    ],
  },
};

export default nextConfig;
