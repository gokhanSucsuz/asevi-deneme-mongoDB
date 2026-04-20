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
  const router = useRouter();
  const pathname = usePathname();

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
      setUser(fbUser);
      
      if (fbUser) {
        normalizeDatabaseTypes();
        
        // Priority 1: Check Local Session (Explicit TC/Pass Login)
        const session = localStorage.getItem('personnel-session');
        let sessionPersonnel = null;
        
        if (session) {
          try {
            const deobfuscated = deobfuscate(session);
            const sessionData = JSON.parse(deobfuscated);
            if (sessionData.id) {
              sessionPersonnel = await db.personnel.get(sessionData.id);
            }
          } catch (e) {
            console.error('Error parsing session:', e);
          }
        }
        
        // Priority 2: Google Email Restrictions
        // If not demo and not specific authorized hardcoded admin emails, check DB
        const authorizedEmails = ['edirnesydv@gmail.com', 'real.lucifer22@gmail.com', 'demo@sydv.org.tr'];
        
        if (fbUser && fbUser.email && !authorizedEmails.includes(fbUser.email)) {
           // Not a developer/demo email, so they MUST be in personnel or drivers table.
           try {
             // Instead of using dexie queries directly, fetch all and filter to avoid API errors
             // since some versions or offline states might block specific queries.
             // We use a fetch directly from backend to avoid 403 on client cache limits.
             
             const token = await fbUser.getIdToken();
             
             // Check Personnel
             const pRes = await fetch('/api/db', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
               body: JSON.stringify({ collection: 'personnel', operation: 'list', query: { email: fbUser.email } })
             });
             const pData = pRes.ok ? await pRes.json() : [];
             const p = Array.isArray(pData) && pData.length > 0 ? pData[0] : null;

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
             
             
             const d = (Array.isArray(dData) && dData.length > 0 ? dData[0] : null) || (Array.isArray(d2Data) && d2Data.length > 0 ? d2Data[0] : null);
             
             if (!p && !d) {
               // Unauthorized Google login
               import('firebase/auth').then(({ signOut }) => {
                 signOut(auth);
               });
               toast.error('Giriş başarısız. Sistemde kayıtlı yetkili bir hesap bulunamadı.');
               setUser(null);
               setPersonnel(null);
               setRole(null);
               setLoading(false);
               router.push('/login');
               return; // exit the callback
             }
           } catch (e) {
             console.error('Validation error:', e);
             toast.error('Giriş doğrulaması sırasında bir hata oluştu. Hesabınız incelenemiyor.');
             import('firebase/auth').then(({ signOut }) => {
                signOut(auth);
             });
             setUser(null);
             setPersonnel(null);
             setRole(null);
             setLoading(false);
             router.push('/login');
             return;
           }
        }

        if (sessionPersonnel && sessionPersonnel.isActive && sessionPersonnel.isApproved) {
          setPersonnel(sessionPersonnel);
        } else {
          // Priority 3: Fallback to Email Lookup (Google Login only)
          try {
            const p = await db.personnel.where('email').equals(fbUser.email).first();
            if (p) {
              setPersonnel(p);
            } else if (fbUser.email === 'demo@sydv.org.tr') {
              const demoP = { name: 'Demo Kullanıcısı', email: 'demo@sydv.org.tr', role: 'admin' };
              setPersonnel(demoP);
            } else {
              setPersonnel(null);
            }
          } catch (e) {
            console.error('Error fetching personnel:', e);
            setPersonnel(null);
          }
        }

        if (fbUser.email === 'demo@sydv.org.tr') {
          setRole('demo');
        } else if (pathname.startsWith('/admin')) {
          setRole('admin');
        } else if (pathname.startsWith('/driver')) {
          setRole('driver');
        } else {
          setRole(null);
        }
      } else {
        setRole(null);
        setPersonnel(null);
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
