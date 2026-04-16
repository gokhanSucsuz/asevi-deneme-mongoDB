'use client';

import { useState } from 'react';
import { db } from '@/lib/db';
import { toast } from 'sonner';
import Image from 'next/image';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const personnel = await db.personnel.where('email').equals(email).first();

      if (!personnel) {
        toast.error('Bu e-posta adresi ile kayıtlı personel bulunamadı.');
        setIsLoading(false);
        return;
      }

      // Generate a strong random password
      const newPassword = Math.random().toString(36).slice(-10) + '!' + Math.floor(Math.random() * 100);
      
      // Update in DB
      await db.personnel.update(personnel.id!, { password: newPassword });

      // Simulate sending email
      console.log(`Email sent to ${email} with new password: ${newPassword}`);
      
      toast.success('Yeni şifreniz e-posta adresinize gönderildi. (Demo: Konsol çıktısına bakın)');
    } catch (error) {
      console.error(error);
      toast.error('Şifre sıfırlama sırasında bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

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
          <h2 className="text-2xl font-bold text-gray-900">Şifremi Unuttum</h2>
          <p className="text-gray-500 mt-2">Kayıtlı e-posta adresinizi girin, size yeni bir şifre gönderelim.</p>
        </div>

        <form onSubmit={handleReset} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">E-posta Adresi</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-3 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 font-medium transition-colors disabled:bg-blue-400"
          >
            {isLoading ? 'Gönderiliyor...' : 'Yeni Şifre Gönder'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/admin/login" className="text-sm text-blue-600 hover:underline">
            Giriş Ekranına Dön
          </Link>
        </div>
      </div>
    </div>
  );
}
