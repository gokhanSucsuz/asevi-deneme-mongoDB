import type {Metadata} from 'next';
import './globals.css'; // Global styles
import { AuthProvider } from '@/components/AuthProvider';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'Aşevi Modülü - SYDV',
  description: 'Sosyal Yardımlaşma ve Dayanışma Vakfı Aşevi Yönetim Sistemi',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <AuthProvider>
          {children}
          <Toaster position="top-center" />
        </AuthProvider>
      </body>
    </html>
  );
}
