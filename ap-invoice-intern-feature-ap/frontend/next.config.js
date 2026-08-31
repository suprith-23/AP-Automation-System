// Next.js configuration for the AP Automation frontend.

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev }) => {
    // Disable Webpack filesystem caching in development mode.
    // This prevents "EIO: i/o error, write/scandir" exceptions caused by Docker
    // file synchronization lag on Windows hosts.
    if (dev) {
      config.cache = { type: "memory" };
    }
    return config;
  },

  // Optimize imports for packages that export many sub-modules.
  // This reduces JS bundle size and parse time by tree-shaking unused exports.
  experimental: {
    optimizePackageImports: ["sonner", "zustand"],
  },

  // Image optimization — serve modern formats when the browser supports them
  images: {
    formats: ["image/avif", "image/webp"],
  },

  // Add cache headers for static assets served by Next.js
  async headers() {
    return [
      {
        // Immutable cache for Next.js static chunks (fingerprinted filenames)
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Short cache for HTML pages — ensures fresh content on navigation
        source: "/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
