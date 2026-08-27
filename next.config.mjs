import path from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(process.cwd());
    
    // Configure Webpack to map relative imports ending in '.js' to '.ts' or '.tsx' files
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    };
    
    return config;
  },
};

export default nextConfig;
