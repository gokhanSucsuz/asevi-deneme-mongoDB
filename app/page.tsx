'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Settings, Truck, LogOut, LogIn } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { auth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { clsx } from 'clsx';

export default function Home() {
  const { user, role, personnel, loading } = useAuth();
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

  const authorizedEmails = ['edirnesydv@gmail.com', 'real.lucifer22@gmail.com', 'demo@sydv.org.tr'];
  const isAuthorizedAdmin = user && (authorizedEmails.includes(user.email || '') || (personnel && personnel.role === 'admin') || role === 'demo');
  const isAuthorizedDriver = user && (isAuthorizedAdmin || (personnel && (personnel.googleEmail || personnel.email)));

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 relative">
      {user && (isAuthorizedAdmin || isAuthorizedDriver) ? (
        <div className="absolute top-4 right-4 flex items-center gap-4 bg-white p-2 px-4 rounded-full shadow-sm border border-gray-200">
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-gray-900">{user.displayName || user.email}</span>
            <span className="text-[10px] text-gray-500">{user.email}</span>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors"
            title="Çıkış Yap"
          >
            <LogOut size={20} />
          </button>
        </div>
      ) : (
        <Link 
          href="/login"
          className="absolute top-4 right-4 flex items-center gap-2 bg-blue-600 text-white p-2 px-6 rounded-full shadow-sm hover:bg-blue-700 transition-all font-medium animate-pulse"
        >
          <LogIn size={18} />
          Giriş Yap
        </Link>
      )}

      <div className="text-center mb-12 flex flex-col items-center">
        <Image 
          src="https://pbs.twimg.com/profile_images/1456143975845404674/xGjOJe4S_400x400.jpg" 
          alt="Vakıf Logosu" 
          width={120} 
          height={120} 
          className="rounded-full mb-6 shadow-lg"
          referrerPolicy="no-referrer"
        />
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Aşevi Modülü</h1>
        <p className="text-lg text-gray-600">Sosyal Yardımlaşma ve Dayanışma Vakfı Başkanlığı</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
        {user && isAuthorizedAdmin && (
          <Link href="/admin" className="group flex flex-col items-center justify-center p-12 bg-white rounded-2xl shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-500 transition-all">
            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Settings size={40} />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Yönetim Paneli</h2>
            <p className="text-gray-500 text-center">Haneler, şoförler, rotalar ve raporlamalar</p>
          </Link>
        )}

        {user && isAuthorizedDriver && (
          <Link href="/driver" className={clsx(
            "group flex flex-col items-center justify-center p-12 bg-white rounded-2xl shadow-sm border border-gray-200 hover:shadow-md hover:border-green-500 transition-all",
            !isAuthorizedAdmin && "md:col-span-2 max-w-xl mx-auto w-full"
          )}>
            <div className="w-20 h-20 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Truck size={40} />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Yemek Dağıtım Paneli</h2>
            <p className="text-gray-500 text-center">Rota takibi, teslimat durumu ve km girişi</p>
          </Link>
        )}

        {(!user || (!isAuthorizedAdmin && !isAuthorizedDriver)) && (
          <div className="md:col-span-2 bg-blue-50 border border-blue-100 p-8 rounded-2xl text-center">
            <p className="text-blue-800 font-medium mb-4">
              {user ? 'Giriş yaptığınız hesap yetkilendirilmemiş. Lütfen yönetici ile iletişime geçin.' : 'Panellere erişmek için lütfen giriş yapın.'}
            </p>
            {!user && (
              <Link 
                href="/login"
                className="inline-flex items-center gap-2 bg-blue-600 text-white py-3 px-8 rounded-full shadow-sm hover:bg-blue-700 transition-all font-bold"
              >
                <LogIn size={20} />
                Google ile Giriş Yap
              </Link>
            )}
            {user && (
              <button 
                onClick={handleLogout}
                className="inline-flex items-center gap-2 bg-red-600 text-white py-3 px-8 rounded-full shadow-sm hover:bg-red-700 transition-all font-bold"
              >
                <LogOut size={20} />
                Farklı Hesapla Giriş Yap
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-16 text-center opacity-40 hover:opacity-100 transition-opacity duration-500">
        <p className="text-[10px] text-gray-400 uppercase tracking-[0.2em] mb-1">
          Tasarlayan ve Yöneten
        </p>
        <p className="text-xs font-semibold text-gray-600">
          Gökhan SUÇSUZ
        </p>
      </div>
    </div>
  );
}
