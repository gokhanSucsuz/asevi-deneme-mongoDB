import type {Metadata} from 'next';
import './globals.css'; // Global styles
import { AuthProvider } from '@/components/AuthProvider';
import { Toaster } from 'sonner';
import { DemoBanner } from '@/components/DemoBanner';

export const metadata: Metadata = {
  title: 'Aşevi Modülü - Edirne SYDV',
  description: 'Edirne Merkez Sosyal Yardımlaşma ve Dayanışma Vakıf Başkanlığı Aşevi Yönetim Sistemi',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="tr">
      <head>
        <link rel="icon" href="https://pbs.twimg.com/profile_images/1456143975845404674/xGjOJe4S_400x400.jpg" />
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>
          <DemoBanner />
          {children}
          <Toaster position="top-center" />
        </AuthProvider>
      </body>
    </html>
  );
}
