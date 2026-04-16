'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/db';
import { toast } from 'sonner';
import Image from 'next/image';
import Link from 'next/link';
import { CheckCircle, Copy, ExternalLink, AlertTriangle, LogIn } from 'lucide-react';
import { auth } from '@/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useAuth } from '@/components/AuthProvider';

export default function AdminRegisterPage() {
  const [formData, setFormData] = useState({
    tcNo: '',
    name: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [approvalLink, setApprovalLink] = useState('');
  const { user } = useAuth();
  const router = useRouter();

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success('Google ile giriş yapıldı.');
    } catch (error) {
      console.error(error);
      toast.error('Google ile giriş yapılırken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(approvalLink);
    toast.success('Onay linki kopyalandı.');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (formData.password !== formData.confirmPassword) {
      toast.error('Şifreler uyuşmuyor.');
      setIsLoading(false);
      return;
    }

    try {
      // Check max personnel limit (2)
      const personnelCount = await db.personnel.count();
      if (personnelCount >= 2) {
        toast.error('Sistemde en fazla 2 yetkili personel kaydı olabilir.');
        setIsLoading(false);
        return;
      }

      // Check if TC No already exists
      const existingTc = await db.personnel.where('tcNo').equals(formData.tcNo).first();
      if (existingTc) {
        toast.error('Bu TC Kimlik No ile zaten bir kayıt bulunmaktadır.');
        setIsLoading(false);
        return;
      }

      // Check if Email already exists
      const existingEmail = await db.personnel.where('email').equals(formData.email).first();
      if (existingEmail) {
        toast.error('Bu e-posta adresi zaten kullanılmaktadır.');
        setIsLoading(false);
        return;
      }

      // Create personnel
      const newPersonnelId = await db.personnel.add({
        tcNo: formData.tcNo,
        name: formData.name,
        username: formData.username,
        email: formData.email,
        password: formData.password,
        role: 'admin',
        isActive: true,
        isApproved: false, // Needs approval
        createdAt: new Date()
      });

      // Provide a direct approval link for the admin
      const approvalLink = `${window.location.origin}/admin/approve/${newPersonnelId}`;
      
      // Send email notification via API
      try {
        const response = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'approval_request',
            data: {
              name: formData.name,
              email: formData.email,
              tcNo: formData.tcNo,
              approvalLink: approvalLink
            }
          })
        });
        
        if (response.ok) {
          setEmailSent(true);
        } else {
          const errorData = await response.json();
          setEmailError(errorData.error || 'Bilinmeyen bir hata oluştu.');
        }
      } catch (emailError) {
        console.error('Email notification failed:', emailError);
        setEmailError('Sunucu bağlantı hatası.');
      }
      
      toast.success('Kaydınız oluşturuldu. Yönetici onayı bekleniyor.');

      // Show the approval link in a modal or just log it for now
      // In a real app, this would be sent via email
      console.log('APPROVAL LINK FOR ADMIN:', approvalLink);
      
      // Store the link in state to show to the user so they can send it to the admin
      setApprovalLink(approvalLink);
      setIsSuccess(true);
    } catch (error) {
      console.error(error);
      toast.error('Kayıt sırasında bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 border border-gray-200 text-center">
          <div className="bg-green-100 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="text-green-600" size={40} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Kayıt Başarılı!</h2>
          <p className="text-gray-600 mb-6">
            Hesabınız oluşturuldu ancak henüz onaylanmadı. Giriş yapabilmek için <strong>edirnesydv@gmail.com</strong> adresinden onay almanız gerekmektedir.
          </p>

          {emailSent ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-left">
              <div className="flex items-center gap-2 text-green-800 font-bold mb-2">
                <CheckCircle size={18} />
                <span>E-posta Gönderildi</span>
              </div>
              <p className="text-xs text-green-700">
                Yöneticiye (edirnesydv@gmail.com) onay talebi e-posta ile iletildi. Onaylandığında size de bir bilgilendirme e-postası gelecektir.
              </p>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-left">
              <div className="flex items-center gap-2 text-amber-800 font-bold mb-2">
                <AlertTriangle size={18} />
                <span>E-posta Gönderilemedi</span>
              </div>
              <p className="text-xs text-amber-700 mb-3">
                Otomatik e-posta bildirimi şu an yapılamıyor: <span className="font-semibold">{emailError}</span>
              </p>
              <p className="text-[10px] text-amber-600">
                Lütfen aşağıdaki &quot;Hızlı Onay Linki&quot;ni yöneticiye manuel olarak iletin.
              </p>
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 text-left">
            <div className="flex items-center gap-2 text-slate-800 font-bold mb-2">
              <ExternalLink size={18} />
              <span>Hızlı Onay Linki (Alternatif)</span>
            </div>
            <p className="text-xs text-slate-600 mb-3">
              E-posta ulaşmaması durumunda bu linki kopyalayıp yöneticiye ileterek onay sürecini hızlandırabilirsiniz:
            </p>
            <div className="flex items-center gap-2 bg-white border border-slate-200 p-2 rounded-lg">
              <code className="text-[10px] text-slate-600 truncate flex-1">{approvalLink}</code>
              <button 
                onClick={copyToClipboard}
                className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 transition-colors"
                title="Kopyala"
              >
                <Copy size={16} />
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <Link 
              href="/admin/login" 
              className="block w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all"
            >
              Giriş Sayfasına Dön
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
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
          <h2 className="text-2xl font-bold text-gray-900">Yetkili Personel Kaydı</h2>
          <p className="text-gray-500 mt-2">Sisteme erişmek için bilgilerinizi doldurun.</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          {!user && (
            <div className="mb-6">
              <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-md mb-4 border border-amber-200">
                Kayıt olabilmek için önce Google hesabınızla giriş yapmalısınız.
              </p>
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 py-3 px-4 rounded-md hover:bg-gray-50 font-medium transition-colors"
              >
                <Image 
                  src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
                  alt="Google" 
                  width={20} 
                  height={20} 
                />
                Google ile Giriş Yap
              </button>
            </div>
          )}

          {user && (
            <div className="bg-blue-50 p-3 rounded-md mb-6 flex items-center gap-3">
              <Image 
                src={user.photoURL || ''} 
                alt="User" 
                width={32} 
                height={32} 
                className="rounded-full"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-blue-900 truncate">{user.displayName}</p>
                <p className="text-xs text-blue-700 truncate">{user.email}</p>
              </div>
              <button 
                type="button"
                onClick={() => auth.signOut()}
                className="text-xs text-blue-600 hover:underline"
              >
                Değiştir
              </button>
            </div>
          )}

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Kayıt Bilgileri</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">TC Kimlik No</label>
            <input
              type="text"
              value={formData.tcNo}
              onChange={(e) => setFormData({ ...formData, tcNo: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
              required
              maxLength={11}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Ad Soyad</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Kullanıcı Adı</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">E-posta</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Şifre</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Şifre Tekrar</label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 font-medium transition-colors disabled:bg-blue-400 mt-4"
          >
            {isLoading ? 'Kaydediliyor...' : 'Kayıt Ol'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/admin/login" className="text-sm text-blue-600 hover:underline">
            Zaten hesabınız var mı? Giriş Yapın
          </Link>
        </div>
      </div>
    </div>
  );
}
