'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { db, normalizeDatabaseTypes } from '@/lib/db';
import { deobfuscate } from '@/lib/utils';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  role: 'admin' | 'driver' | 'demo' | null;
  personnel: any | null;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, role: null, personnel: null });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [personnel, setPersonnel] = useState<any | null>(null);
  const [role, setRole] = useState<'admin' | 'driver' | 'demo' | null>(null);
  const [loading, setLoading] = useState(true);
  const [toastShown, setToastShown] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Clear toast state on logout
    if (!user && toastShown) {
      setToastShown(null);
    }
  }, [user, toastShown]);

  useEffect(() => {
    const isDemo = typeof window !== 'undefined' && localStorage.getItem('isDemoUser') === 'true';
    if (isDemo) {
      setUser({
        uid: 'demo-uid',
        email: 'demo@sydv.org.tr',
        displayName: 'Demo Kullanıcısı',
        emailVerified: true,
        isAnonymous: false,
        metadata: {},
        providerData: [],
        refreshToken: '',
        tenantId: null,
        delete: async () => {},
        getIdToken: async () => '',
        getIdTokenResult: async () => ({} as any),
        reload: async () => {},
        toJSON: () => ({}),
        phoneNumber: null,
        photoURL: null,
        providerId: 'demo'
      } as any);
      const demoP = { name: 'Demo Kullanıcısı', email: 'demo@sydv.org.tr', role: 'admin' };
      setPersonnel(demoP);
      setRole('demo');
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        normalizeDatabaseTypes();
        
        // Priority 1: Check Demo
        if (fbUser.email === 'demo@sydv.org.tr') {
          const demoP = { name: 'Demo Kullanıcısı', email: 'demo@sydv.org.tr', role: 'admin' };
          setPersonnel(demoP);
          setUser(fbUser);
          setRole('demo');
          setLoading(false);
          return;
        }

        // Priority 2: Google Email Restrictions
        const authorizedEmails = ['edirnesydv@gmail.com', 'real.lucifer22@gmail.com'];
        let isAuthorized = authorizedEmails.includes(fbUser.email || '');
        let pFound = null;
        let dFound = null;

        if (!isAuthorized) {
          try {
            const token = await fbUser.getIdToken();
            
            // Check Personnel
            const pRes = await fetch('/api/db', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ collection: 'personnel', operation: 'list', query: { email: fbUser.email } })
            });
            const pData = pRes.ok ? await pRes.json() : [];
            pFound = Array.isArray(pData) && pData.length > 0 ? pData[0] : null;

            if (pFound) {
              isAuthorized = true;
            } else {
              // Check Drivers
              const dRes = await fetch('/api/db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ collection: 'drivers', operation: 'list', query: { googleEmail: fbUser.email } })
              });
              const dData = dRes.ok ? await dRes.json() : [];
              
              const d2Res = await fetch('/api/db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ collection: 'dr_drivers', operation: 'list', query: { googleEmail: fbUser.email } })
              });
              const d2Data = d2Res.ok ? await d2Res.json() : [];
              
              dFound = (Array.isArray(dData) && dData.length > 0 ? dData[0] : null) || (Array.isArray(d2Data) && d2Data.length > 0 ? d2Data[0] : null);
              if (dFound) isAuthorized = true;
            }
          } catch (e) {
            console.error('Validation error:', e);
          }
        }

        if (!isAuthorized) {
          // Unauthorized Google login
          import('firebase/auth').then(({ signOut }) => {
            signOut(auth);
          });
          
          if (toastShown !== 'error_' + fbUser.uid) {
            toast.error('Yetkisiz Hesap', {
              description: 'Giriş yaptığınız hesap sistemde yetkilendirilmemiş. Lütfen yöneticinizle iletişime geçin.',
              id: 'auth-error'
            });
            setToastShown('error_' + fbUser.uid);
          }
          
          setUser(null);
          setPersonnel(null);
          setRole(null);
          setLoading(false);
          router.push('/login');
          return;
        }

        // Authorized
        if (toastShown !== 'success_' + fbUser.uid) {
          toast.success('Giriş Başarılı', {
            description: `Hoş geldiniz, ${fbUser.displayName || 'Kullanıcı'}`,
            id: 'auth-success'
          });
          setToastShown('success_' + fbUser.uid);
        }
        
        setUser(fbUser);
        
        // Finalize personnel/role
        if (pFound) {
          setPersonnel(pFound);
        } else if (dFound) {
          setPersonnel(dFound);
        } else {
          // Check local DB/Session fallback if needed
          const session = localStorage.getItem('personnel-session');
          if (session) {
            try {
              const deobfuscated = deobfuscate(session);
              const sessionData = JSON.parse(deobfuscated);
              const p = await db.personnel.get(sessionData.id);
              if (p && p.isActive && p.isApproved) setPersonnel(p);
            } catch (e) { console.error(e); }
          }
        }

        if (pathname.startsWith('/admin')) {
          setRole('admin');
        } else if (pathname.startsWith('/driver')) {
          setRole('driver');
        } else {
          setRole(null);
        }
      } else {
        setUser(null);
        setRole(null);
        setPersonnel(null);
        setToastShown(null);
      }
      
      setLoading(false);
      
      if (!fbUser && !pathname.startsWith('/admin') && pathname !== '/' && pathname !== '/login') {
        router.push('/login');
      }
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <AuthContext.Provider value={{ user, loading, role, personnel }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
