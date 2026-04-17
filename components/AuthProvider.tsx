'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { normalizeDatabaseTypes } from '@/lib/db';

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
      setRole('demo');
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (user) {
        // Only normalize data when we have a real user
        normalizeDatabaseTypes();

        // Try to find personnel record
        try {
          const p = await db.personnel.where('email').equals(user.email).first();
          if (p) {
            setPersonnel(p);
            // Update session in localStorage for legacy compatibility
            localStorage.setItem('personnel-session', JSON.stringify(p));
          } else {
            // Check for demo user
            if (user.email === 'demo@sydv.org.tr') {
              const demoP = { name: 'Demo Kullanıcısı', email: 'demo@sydv.org.tr', role: 'admin' };
              setPersonnel(demoP);
              localStorage.setItem('personnel-session', JSON.stringify(demoP));
            } else {
              setPersonnel(null);
            }
          }
        } catch (e) {
          console.error('Error fetching personnel:', e);
        }

        if (user.email === 'demo@sydv.org.tr') {
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
      }
      
      setLoading(false);
      
      if (!user && !pathname.startsWith('/admin') && pathname !== '/' && pathname !== '/login') {
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
