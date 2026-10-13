import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { dev }) => {
    if (dev) {
      // Writing to the SQLite file must not trigger a dev rebuild, otherwise
      // every create/edit/delete reloads the page and can race with requests.
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ["**/node_modules/**", "**/.git/**", "**/.next/**", "**/*.db", "**/*.db-journal"],
      };
    }
    return config;
  },
};

export default nextConfig;
