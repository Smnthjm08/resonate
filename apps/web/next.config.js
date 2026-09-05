/** @type {import('next').NextConfig} */
const nextConfig = {
  // @repo/game-core ships raw TypeScript from src/, so Next has to compile it.
  transpilePackages: ["@repo/game-core"],
};

export default nextConfig;
