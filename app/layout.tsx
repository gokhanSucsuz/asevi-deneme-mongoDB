import type {Metadata} from 'next';
import './globals.css'; // Global styles
import { AuthProvider } from '@/components/AuthProvider';
import { Toaster } from 'sonner';
import { DemoBanner } from '@/components/DemoBanner';

export const metadata: Metadata = {
  title: 'Aşevi Yönetim Sistemi - Edirne SYDV',
  description: 'Edirne Merkez Sosyal Yardımlaşma ve Dayanışma Vakıf Başkanlığı Aşevi Yönetim Sistemi',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="tr">
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
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
