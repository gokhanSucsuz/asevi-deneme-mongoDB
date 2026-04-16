'use client';
import { useEffect, useState } from 'react';

export function DemoBanner() {
  const [isDemo, setIsDemo] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('isDemoUser') === 'true';
    }
    return false;
  });

  useEffect(() => {
    const handleStorage = () => {
      setIsDemo(localStorage.getItem('isDemoUser') === 'true');
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  if (!isDemo) return null;

  return (
    <div className="bg-amber-500 text-white text-center py-2 px-4 font-bold text-sm z-50 relative shadow-md flex justify-center items-center gap-4">
      <span>⚠️ DEMO MODUNDASINIZ - Veriler gerçek değildir ve değişiklikler kaydedilmez.</span>
      <button 
        onClick={() => {
          localStorage.removeItem('isDemoUser');
          window.location.href = '/login';
        }}
        className="bg-white text-amber-600 px-3 py-1 rounded text-xs hover:bg-amber-50 transition-colors"
      >
        Çıkış Yap
      </button>
    </div>
  );
}
