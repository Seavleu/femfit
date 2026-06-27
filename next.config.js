/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
      remotePatterns: [
        {
          protocol: "https",
          hostname: "placehold.co",
        },
        {
          protocol: "https",
          hostname: "*.supabase.co",
          pathname: "/storage/v1/object/public/**",
        },
        {
          protocol: "https",
          hostname: "*.cloudflare.com",
        },
      ],
    },
  };
  
  module.exports = nextConfig;