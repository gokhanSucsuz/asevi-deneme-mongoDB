'use client';

import { useState, useEffect } from 'react';
import { signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { auth, googleProvider } from '@/firebase';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { LogIn } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();

  const [isInIframe, setIsInIframe] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [showDemoLogin, setShowDemoLogin] = useState(false);
  const [demoEmail, setDemoEmail] = useState('');
  const [demoPassword, setDemoPassword] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInIframe(window.self !== window.top);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const checkRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          // Success message removed - AuthProvider will handle it after verification
          router.push('/');
        }
      } catch (error: any) {
        console.error("Redirect login error:", error);
        toast.error('Giriş yapılırken bir hata oluştu.');
      }
    };
    checkRedirectResult();
  }, [router]);

  const handleLogin = async () => {
    try {
      if (isInIframe) {
        setIsRedirecting(true);
        await signInWithRedirect(auth, googleProvider);
      } else {
        await signInWithPopup(auth, googleProvider);
        // Success message removed - AuthProvider will handle it after verification
        router.push('/');
      }
    } catch (error: any) {
      setIsRedirecting(false);
      console.error(error);
      if (error.code === 'auth/popup-blocked') {
        toast.error('Giriş penceresi engellendi. Lütfen pop-up izinlerini kontrol edin.');
      } else if (error.message?.includes('Cross-Origin-Opener-Policy')) {
        // Fallback to redirect if popup fails due to COOP
        setIsRedirecting(true);
        await signInWithRedirect(auth, googleProvider);
      } else {
        toast.error('Giriş yapılırken bir hata oluştu. Reklam engelleyicinizi kapatmayı deneyin.');
      }
    }
  };

  const openInNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  const handleDemoLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (demoEmail === 'demo@sydv.org.tr' && demoPassword === '123456') {
      localStorage.setItem('isDemoUser', 'true');
      toast.success('Demo moduna giriş yapıldı');
      window.location.href = '/'; // Force reload to apply demo state
    } else {
      toast.error('Hatalı e-posta veya şifre');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center">
        <Image 
          src="https://pbs.twimg.com/profile_images/1456143975845404674/xGjOJe4S_400x400.jpg" 
          alt="Vakıf Logosu" 
          width={100} 
          height={100} 
          className="rounded-full mb-6 shadow-md"
          referrerPolicy="no-referrer"
        />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Aşevi Yönetim Sistemi</h1>
        <p className="text-gray-500 text-center mb-8">Devam etmek için lütfen giriş yapın</p>
        
        {showDemoLogin ? (
          <form onSubmit={handleDemoLogin} className="w-full space-y-4">
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mb-4">
              <p className="text-xs text-blue-800 font-medium">Demo Giriş Bilgileri:</p>
              <p className="text-xs text-blue-700 mt-1">E-posta: demo@sydv.org.tr</p>
              <p className="text-xs text-blue-700">Şifre: 123456</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-posta</label>
              <input
                type="email"
                value={demoEmail}
                onChange={(e) => setDemoEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="demo@sydv.org.tr"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Şifre</label>
              <input
                type="password"
                value={demoPassword}
                onChange={(e) => setDemoPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="123456"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Giriş Yap
            </button>
            <button
              type="button"
              onClick={() => setShowDemoLogin(false)}
              className="w-full text-gray-500 hover:text-gray-700 text-sm mt-2"
            >
              Geri Dön
            </button>
          </form>
        ) : (
          <div className="space-y-4 w-full">
            <button
              onClick={handleLogin}
              disabled={isRedirecting}
              className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LogIn size={20} />
              {isRedirecting ? 'Yönlendiriliyor...' : 'Google ile Giriş Yap'}
            </button>

            <button
              onClick={() => setShowDemoLogin(true)}
              className="w-full flex items-center justify-center gap-3 bg-gray-800 text-white px-6 py-3 rounded-lg hover:bg-gray-900 transition-colors font-medium"
            >
              Demo Hesabı ile Giriş
            </button>

            {isInIframe && (
              <button
                onClick={openInNewTab}
                className="w-full flex items-center justify-center gap-3 bg-blue-50 text-blue-700 px-6 py-3 rounded-lg hover:bg-blue-100 transition-colors font-medium text-sm"
              >
                Uygulamayı Yeni Sekmede Aç
              </button>
            )}
          </div>
        )}

        <div className="mt-8 p-4 bg-amber-50 rounded-lg border border-amber-100">
          <p className="text-xs text-amber-800 leading-relaxed">
            <strong>Not:</strong> Eğer giriş yaparken hata alıyorsanız:
            <br />1. Reklam engelleyicinizi (Ad-Blocker) bu site için kapatın.
            <br />2. Uygulamayı yukarıdaki butonla yeni sekmede açarak deneyin.
          </p>
        </div>
      </div>
    </div>
  );
}
