import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/docs'],
        disallow: ['/dashboard', '/errors', '/calls', '/login', '/api'],
      },
    ],
    sitemap: 'https://voxray.vercel.app/sitemap.xml',
  };
}
