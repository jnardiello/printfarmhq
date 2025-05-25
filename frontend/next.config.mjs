/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    // In Docker environment, proxy API calls to backend service
    if (process.env.DOCKER_ENV === 'true') {
      return [
        {
          source: '/api/:path*',
          destination: 'http://backend:8000/:path*',
        },
      ]
    }
    return []
  },
}

export default nextConfig
