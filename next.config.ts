import type { NextConfig } from "next";
import { supabaseConfig } from "./src/lib/env/public";
import {
  securityHeaders,
  privateCacheHeaders,
} from "./src/lib/security/headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  images: {
    formats: ["image/webp"],
    qualities: [75],
    maximumRedirects: 0,
    dangerouslyAllowSVG: false,
    dangerouslyAllowLocalIP: false,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders(
          process.env.NODE_ENV === "production",
          supabaseConfig()?.url,
        ),
      },
      ...[
        "/workspace/:path*",
        "/catalogue/:path*",
        "/orders/:path*",
        "/enquiries/:path*",
        "/sign-in",
        "/api/:path*",
      ].map((source) => ({ source, headers: privateCacheHeaders })),
    ];
  },
  reactCompiler: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
