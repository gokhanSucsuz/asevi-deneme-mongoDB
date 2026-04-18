'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { db } from '@/lib/db';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthProvider';
import { ShieldCheck, AlertTriangle, CheckCircle, LogIn } from 'lucide-react';
import { auth } from '@/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

export default function ApprovePersonnelPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const router = useRouter();
  const [personnel, setPersonnel] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const authorizedEmails = ['edirnesydv@gmail.com', 'real.lucifer22@gmail.com'];
  const isAuthorizedAdmin = user && authorizedEmails.includes(user.email || '');

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success('Giriş başarılı.');
    } catch (error) {
      console.error(error);
      toast.error('Giriş yapılamadı.');
    }
  };

  useEffect(() => {
    const fetchPersonnel = async () => {
      if (!id || !user) {
        if (!id) setIsLoading(false);
        // If no user, we still want to stop loading so we can show the login button
        if (!user && id) setIsLoading(false); 
        return;
      }
      try {
        const p = await db.personnel.get(id as string);
        setPersonnel(p);
      } catch (error) {
        console.error('Error fetching personnel:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPersonnel();
  }, [id, user]);

  const handleApprove = async () => {
    if (!isAuthorizedAdmin) {
      toast.error('Bu işlemi yapmaya yetkiniz bulunmamaktadır.');
      return;
    }

    if (personnel?.isApproved) {
      toast.info('Bu personel zaten onaylanmış.');
      return;
    }

    setIsProcessing(true);
    try {
      await db.personnel.update(id as string, { isApproved: true });
      
      // Notify the user via email
      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'approval_notification',
            data: {
              name: personnel.name,
              email: personnel.email
            }
          })
        });
      } catch (emailError) {
        console.error('User notification email failed:', emailError);
      }

      const { addSystemLog } = await import('@/lib/logger');
      await addSystemLog(
        user,
        null, // No need for specific personnel object since it's just user context
        'Personel Onaylandı (Hızlı Onay)',
        `${personnel.name} personeli hızlı onay linki ile onaylandı.`,
        'personnel'
      );

      toast.success('Personel başarıyla onaylandı.');
      router.push('/admin/personnel');
    } catch (error) {
      console.error(error);
      toast.error('Onaylama sırasında bir hata oluştu.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!personnel) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-gray-200">
          <AlertTriangle className="text-red-500 mx-auto mb-4" size={48} />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Personel Bulunamadı</h1>
          <p className="text-gray-600 mb-6">Onaylanmak istenen personel kaydı sistemde bulunamadı veya silinmiş olabilir.</p>
          <button onClick={() => router.push('/admin')} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold">
            Ana Sayfaya Dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-200">
        <div className="text-center mb-8">
          <div className="bg-blue-100 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="text-blue-600" size={40} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Personel Onaylama</h1>
          <p className="text-gray-500 mt-2">Aşağıdaki personelin sisteme erişimini onaylamak üzeresiniz.</p>
        </div>

        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-8 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Ad Soyad:</span>
            <span className="font-bold text-slate-900">{personnel.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">E-posta:</span>
            <span className="font-bold text-slate-900">{personnel.email}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">TC No:</span>
            <span className="font-bold text-slate-900">{personnel.tcNo}</span>
          </div>
          <div className="pt-3 border-t border-slate-200">
            <div className="flex items-center gap-2 text-xs text-amber-600 font-medium">
              <CheckCircle size={14} />
              <span>Onay sonrası personel sisteme giriş yapabilecektir.</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {!user ? (
            <button
              onClick={handleGoogleLogin}
              className="w-full bg-white border-2 border-slate-200 text-slate-700 py-4 rounded-xl font-bold transition-all hover:bg-slate-50 flex items-center justify-center gap-2 shadow-sm"
            >
              <LogIn size={20} className="text-blue-600" />
              Yönetici Hesabı ile Giriş Yap
            </button>
          ) : !isAuthorizedAdmin ? (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-center">
              <p className="text-sm text-red-700 font-medium">
                Giriş yaptığınız hesap ({user.email}) bu işlemi yapmaya yetkili değil.
              </p>
            </div>
          ) : personnel.isApproved ? (
            <div className="p-4 bg-green-50 border border-green-100 rounded-xl text-center flex items-center justify-center gap-2">
              <CheckCircle size={20} className="text-green-600" />
              <p className="text-sm text-green-700 font-bold">
                Bu personel zaten onaylanmış.
              </p>
            </div>
          ) : (
            <button
              onClick={handleApprove}
              disabled={isProcessing}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold transition-all shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isProcessing ? 'Onaylanıyor...' : 'Onayla ve Yetkilendir'}
            </button>
          )}
          
          <button
            onClick={() => router.push('/admin')}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-semibold transition-all"
          >
            {personnel.isApproved ? 'Yönetim Paneline Git' : 'İptal'}
          </button>
        </div>
      </div>
    </div>
  );
}
