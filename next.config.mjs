/** @type {import('next').NextConfig} */
const config = {
  experimental: {
    serverComponentsExternalPackages: ['@libsql/client'],
  },
}

export default config
