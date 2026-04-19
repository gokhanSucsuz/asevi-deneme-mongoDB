'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/db';
import { toast } from 'sonner';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, LogIn } from 'lucide-react';
import { auth } from '@/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useAuth } from '@/components/AuthProvider';

export default function AdminLoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success('Google ile giriş yapıldı.');
      // AdminLayout will handle the redirection
    } catch (error) {
      console.error(error);
      toast.error('Google ile giriş yapılırken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Try to find by TC No or Email
      let personnel = await db.personnel.where('tcNo').equals(identifier).first();
      
      if (!personnel) {
        personnel = await db.personnel.where('email').equals(identifier).first();
      }

      if (!personnel) {
        toast.error('Bu TC Kimlik No veya E-posta ile kayıtlı personel bulunamadı.');
        setIsLoading(false);
        return;
      }

      // Note: The API automatically decrypts sensitive fields like password
      // for authorized requests (Google Login was successful and session is being verified)
      if (personnel.password !== password) {
        toast.error('Hatalı şifre.');
        setIsLoading(false);
        return;
      }

      if (!personnel.isActive) {
        toast.error('Hesabınız pasif durumdadır. Lütfen yönetici ile iletişime geçin.');
        setIsLoading(false);
        return;
      }

      if (!personnel.isApproved) {
        toast.error('Hesabınız henüz onaylanmamıştır. Lütfen edirnesydv@gmail.com adresinden onay bekleyin.');
        setIsLoading(false);
        return;
      }

      // Success
      localStorage.setItem('personnel-session', JSON.stringify({
        id: personnel.id,
        tcNo: personnel.tcNo,
        name: personnel.name
      }));

      toast.success('Başarıyla giriş yapıldı.');
      // Force reload to trigger AdminLayout auth check reliably
      window.location.href = '/admin';
    } catch (error) {
      console.error(error);
      toast.error('Giriş yapılırken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 relative">
      <Link 
        href="/" 
        className="absolute top-8 left-8 flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors font-medium"
      >
        <ArrowLeft size={20} />
        Ana Sayfaya Dön
      </Link>

      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8 border border-gray-200">
        <div className="text-center mb-8">
          <Image 
            src="https://pbs.twimg.com/profile_images/1456143975845404674/xGjOJe4S_400x400.jpg" 
            alt="Vakıf Logosu" 
            width={80} 
            height={80} 
            className="rounded-full mx-auto mb-4"
            referrerPolicy="no-referrer"
          />
          <h2 className="text-2xl font-bold text-gray-900">Yönetici Girişi</h2>
          <p className="text-gray-500 mt-2 text-sm">2. Adım: Lütfen personel bilgilerinizle doğrulama yapın.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {user && (
            <div className="bg-blue-50 p-3 rounded-md mb-6 flex items-center gap-3 border border-blue-100">
              {user.photoURL && (
                <Image 
                  src={user.photoURL} 
                  alt="User" 
                  width={32} 
                  height={32} 
                  className="rounded-full"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-blue-900 truncate">{user.displayName || 'Yetkili Hesap'}</p>
                <p className="text-[10px] text-blue-700 truncate">{user.email}</p>
              </div>
              <div className="px-2 py-1 bg-blue-200 text-blue-800 text-[10px] font-bold rounded uppercase">
                Onaylı
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">TC Kimlik No veya E-posta</label>
            <div className="relative">
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="TC No veya E-posta adresiniz"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-3 focus:ring-blue-500 focus:border-blue-500 transition-all"
                required
              />
            </div>
            <p className="mt-1 text-[10px] text-gray-500 italic">Personel kartınızdaki TC No veya kayıtlı e-postanız ile giriş yapabilirsiniz.</p>
          </div>

          <div>
            <div className="flex justify-between items-center">
              <label className="block text-sm font-medium text-gray-700">Şifre</label>
              <Link href="/admin/forgot-password" className="text-sm text-blue-600 hover:underline">
                Şifremi Unuttum
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-3 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 font-medium transition-colors disabled:bg-blue-400"
          >
            {isLoading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-sm text-gray-600">
            Hesabınız yok mu?{' '}
            <Link href="/admin/register" className="text-blue-600 font-medium hover:underline">
              Kayıt Olun
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
