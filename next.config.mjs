/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // 네이티브 모듈은 번들링하지 않고 서버 런타임에서 그대로 require 한다.
    serverComponentsExternalPackages: ['better-sqlite3', 'mysql2'],
  },
  // WSL 에서 /mnt/c 아래 파일은 변경 이벤트가 오지 않아, dev 서버가 수정을 감지하도록 폴링한다.
  webpack: (config, { dev }) => {
    if (dev) config.watchOptions = { ...config.watchOptions, poll: 1000, aggregateTimeout: 300 };
    return config;
  },
};

export default nextConfig;
