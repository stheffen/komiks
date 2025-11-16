/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "storage.shngm.id",
      },
      {
        protocol: "https",
        hostname: "delivery.shngm.id",
      },
    ],
  },
};

export default nextConfig;
