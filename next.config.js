/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['pdf-lib', 'pdf-parse']
}

module.exports = nextConfig
