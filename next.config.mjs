import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Optimisations de production
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  
  // Configuration des images
  images: {
    formats: ["image/avif", "image/webp"],
    domains: [],
  },
  
  // Headers de sécurité
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
        ],
      },
    ];
  },
  
  // Configuration expérimentale
  experimental: {
    optimizeCss: true,
  },
  // Routes typées
  typedRoutes: true,
};

export default withBundleAnalyzer(nextConfig);