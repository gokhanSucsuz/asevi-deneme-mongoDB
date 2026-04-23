import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Sıcak Yemek Dağıtım Sistemi',
    short_name: 'Aşevi SYDV',
    description: 'Edirne SYDV Sıcak Yemek Dağıtım Sistemi ve Şoför Uygulaması',
    start_url: '/driver', // Drivers should start at the driver page (or root, which checks auth)
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#3b82f6',
    icons: [
      {
        src: '/icon.svg',
        sizes: '192x192 512x512',
        type: 'image/svg+xml',
        purpose: 'maskable',
      }
    ],
  };
}
