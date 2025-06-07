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
      const backendUrl = process.env.BACKEND_URL || 'http://backend:8000'
      return [
        {
          source: '/api/(.*)',
          destination: `${backendUrl}/$1`,
        },
      ]
    }
    return []
  },
}

export default nextConfig
