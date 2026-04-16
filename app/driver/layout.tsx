'use client';

import Link from 'next/link';
import { Home, LogOut } from 'lucide-react';
import { auth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('personnel-session');
      toast.success('Başarıyla çıkış yapıldı');
      router.push('/');
    } catch (error) {
      console.error(error);
      toast.error('Çıkış yapılırken bir hata oluştu');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-green-600 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold">Yemek Dağıtım Paneli</h1>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-white hover:text-green-100 flex items-center text-sm font-medium">
              <Home className="mr-2 h-5 w-5" />
              Ana Sayfa
            </Link>
            <button 
              onClick={handleLogout}
              className="text-white hover:text-red-100 flex items-center text-sm font-medium"
            >
              <LogOut className="mr-2 h-5 w-5" />
              Çıkış Yap
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 py-8 w-full px-4">
        {children}
      </main>
      <footer className="py-6 text-center opacity-40 hover:opacity-100 transition-opacity">
        <p className="text-[9px] text-gray-400 uppercase tracking-[0.2em] mb-1">
          Tasarlayan ve Yöneten
        </p>
        <p className="text-[10px] font-semibold text-gray-600">
          Gökhan SUÇSUZ
        </p>
      </footer>
    </div>
  );
}
