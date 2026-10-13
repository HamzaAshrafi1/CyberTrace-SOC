import type { NextConfig } from "next";
import path from "path";

if (process.env.NODE_ENV === "production" && process.env.PLAYWRIGHT_TEST === "true") {
  throw new Error("Production cannot enable PLAYWRIGHT_TEST");
}

const isTestMode = process.env.PLAYWRIGHT_TEST === "true";

const nextConfig: NextConfig = {
  output: "standalone",
  webpack: (config) => {
    if (isTestMode) {
      config.resolve.alias["@clerk/nextjs/server"] = path.resolve(process.cwd(), "./src/lib/clerk-mock-server.ts");
      config.resolve.alias["@clerk/nextjs"] = path.resolve(process.cwd(), "./src/lib/clerk-mock-client.ts");
    }
    return config;
  },
  turbopack: isTestMode
    ? {
        resolveAlias: {
          "@clerk/nextjs/server": "./src/lib/clerk-mock-server.ts",
          "@clerk/nextjs": "./src/lib/clerk-mock-client.ts",
        },
      }
    : {},
};

export default nextConfig;
