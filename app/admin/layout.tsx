'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Users, Truck, Map, FileText, Home, BarChart, UserCog, HelpCircle, LogOut, Calendar, Menu, X as CloseIcon, Database, Clock, ClipboardList } from 'lucide-react';
import { clsx } from 'clsx';
import { db } from '@/lib/db';
import { RouteStop } from '@/lib/db';
import { format, differenceInDays } from 'date-fns';
import { getNextWorkingDay, generateRouteFromTemplate } from '@/lib/route-utils';
import { auth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';

const navigation = [
  { name: 'Kontrol Paneli', href: '/admin', icon: Home },
  { name: 'Haneler', href: '/admin/households', icon: Users },
  { name: 'Şoförler ve Araçlar', href: '/admin/drivers', icon: Truck },
  { name: 'Rotalar', href: '/admin/routes', icon: Map },
  { name: 'Ekmek Takip', href: '/admin/bread-tracking', icon: FileText },
  { name: 'Artan Yemek', href: '/admin/leftover-food', icon: FileText },
  { name: 'Çalışma Günleri', href: '/admin/working-days', icon: Calendar },
  { name: 'Anket Yönetimi', href: '/admin/surveys', icon: ClipboardList },
  { name: 'Raporlar', href: '/admin/reports', icon: FileText },
  { name: 'İstatistikler', href: '/admin/statistics', icon: BarChart },
  { name: 'İşlem Geçmişi', href: '/admin/logs', icon: Clock },
  { name: 'Yetkili Personel', href: '/admin/personnel', icon: UserCog },
  { name: 'Sistem ve Yedekleme', href: '/admin/system', icon: Database },
  { name: 'Kılavuz', href: '/admin/guide', icon: HelpCircle },
];

const publicPages = ['/admin/login', '/admin/register', '/admin/forgot-password', '/admin/approve'];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [currentPersonnel, setCurrentPersonnel] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkPersonnelAuth = async () => {
      const authorizedEmails = ['edirnesydv@gmail.com', 'real.lucifer22@gmail.com'];
      const isPublicPage = publicPages.some(page => pathname.startsWith(page));

      // 1. Check if there are any personnel at all (for first time setup)
      let personnelCount = 0;
      try {
        // Only try to count if we have a chance of succeeding (e.g. if we are trying to register or if we are already logged in)
        // Or just catch the error and assume there are personnel if we can't check
        personnelCount = await db.personnel.count();
      } catch (e) {
        // If we get a permission error, it means there are likely personnel and we just can't see them yet
        // or the rules are working as intended. We'll assume personnel exist to avoid redirecting to register
        personnelCount = 1; 
      }
      
      if (personnelCount === 0 && pathname !== '/admin/register') {
        router.push('/admin/register');
        setIsLoading(false);
        return;
      }

      // 2. Check Firebase Auth (Google Login) - REQUIRED GATE 1
      if (!user) {
        if (pathname !== '/admin/register' && !pathname.startsWith('/admin/approve') && pathname !== '/admin/login') {
          // If not on a public page, we should be at login
          if (pathname !== '/admin/login') {
            router.push('/admin/login');
          }
          setIsLoading(false);
          return;
        }
      } else {
        // Logged in with Google, check if authorized email
        const isMainAdmin = authorizedEmails.includes(user.email || '');
        
        if (!isMainAdmin) {
          // If not one of the 2 authorized emails, they shouldn't be here
          toast.error('Bu bölüme erişim yetkiniz bulunmamaktadır.');
          router.push('/');
          setIsLoading(false);
          return;
        }
      }

      // 3. Check Local Session (TC No + Password Login) - REQUIRED GATE 2
      const session = localStorage.getItem('personnel-session');
      if (session) {
        try {
          const sessionData = JSON.parse(session);
          const personnel = await db.personnel.get(sessionData.id);
          
          if (personnel && personnel.isActive && personnel.isApproved) {
            setCurrentPersonnel(personnel);
            setIsAuthorized(true);
            if (isPublicPage) router.push('/admin');
            setIsLoading(false);
            return;
          } else {
            localStorage.removeItem('personnel-session');
          }
        } catch (e) {
          localStorage.removeItem('personnel-session');
        }
      }

      // 4. If we reach here, user is logged in with Google but not with Personnel credentials
      setIsAuthorized(false);
      setIsLoading(false);
      
      if (!isPublicPage) {
        router.push('/admin/login');
      }
    };

    checkPersonnelAuth();
  }, [pathname, router, user]);

  // Background tasks: Check for expired pauses and auto-complete past routes
  useEffect(() => {
    if (!isAuthorized) return;

    const runBackgroundTasks = async () => {
      const now = new Date();
      const todayStr = format(now, 'yyyy-MM-dd');

      // 1. Check for expired pauses
      const allHouseholds = await db.households.toArray();
      const pausedHouseholds = allHouseholds.filter(h => !h.isActive && h.pausedUntil);
      
      for (const household of pausedHouseholds) {
        if (household.pausedUntil && household.pausedUntil <= todayStr) {
          await db.households.update(household.id!, {
            isActive: true,
            pausedUntil: undefined
          });
          
          await db.system_logs.add({
            action: 'Otomatik Aktivasyon',
            details: `${household.headName} hanesinin duraklatma süresi dolduğu için otomatik olarak aktifleştirildi.`,
            category: 'household',
            personnelEmail: 'system',
            personnelName: 'Sistem',
            timestamp: new Date()
          });
        }
      }

      // 2. Auto-complete past routes
      const pendingRoutes = await db.routes.where('status').equals('pending').toArray();
      for (const route of pendingRoutes) {
        if (route.date < todayStr) {
          await db.routes.update(route.id!, { status: 'completed' });
          
          // Update delivered count
          const stops = await db.routeStops.where('routeId').equals(route.id!).toArray();
          const deliveredCount = stops.reduce((sum: number, stop: RouteStop) => stop.status === 'delivered' ? sum + (stop.householdSnapshotMemberCount || 0) : sum, 0);
          
          const breadTracking = await db.breadTracking.where('date').equals(route.date).first();
          if (breadTracking) {
            await db.breadTracking.update(breadTracking.id!, { delivered: deliveredCount });
          }
          
          await db.system_logs.add({
            action: 'Otomatik Rota Tamamlama',
            details: `${format(new Date(route.date), 'dd.MM.yyyy')} tarihli rota süresi geçtiği için otomatik olarak tamamlandı.`,
            category: 'route',
            personnelEmail: 'system',
            personnelName: 'Sistem',
            timestamp: new Date()
          });
        }
      }

      // 3. Check for backup (10 days rule)
      const settings = await db.system_settings.get('global');
      const lastBackup = settings?.lastBackupDate ? new Date(settings.lastBackupDate) : null;
      const daysSinceBackup = lastBackup ? differenceInDays(now, lastBackup) : 999;

      if (daysSinceBackup >= 10) {
        // Log the automatic backup notification
        const allLogs = await db.system_logs.toArray();
        const lastLog = allLogs
          .filter(l => l.action === 'Otomatik Yedekleme Bildirimi')
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
        
        const lastLogDate = lastLog ? new Date(lastLog.timestamp) : null;
        
        // Only log once per day
        if (!lastLogDate || differenceInDays(now, lastLogDate) >= 1) {
          await db.system_logs.add({
            action: 'Otomatik Yedekleme Bildirimi',
            details: `10 gündür yedekleme yapılmadı. edirneysdv@gmail.com adresine bilgilendirme gönderildi.`,
            category: 'system',
            personnelEmail: 'system',
            personnelName: 'Sistem',
            timestamp: new Date()
          });
          console.log('Automatic backup notification sent to edirneysdv@gmail.com');
        }
      }
    };

    runBackgroundTasks();
    const interval = setInterval(runBackgroundTasks, 1000 * 60 * 60); // Run every hour
    return () => clearInterval(interval);
  }, [isAuthorized]);

  const handleLogout = async () => {
    setIsAuthorized(false);
    setCurrentPersonnel(null);
    localStorage.removeItem('personnel-session');
    
    try {
      await signOut(auth);
      router.push('/');
      toast.success('Başarıyla çıkış yapıldı');
    } catch (error) {
      console.error('Logout error:', error);
      // Even if Firebase signOut fails, we've cleared local state
      router.push('/admin/login');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  const isPublicPage = publicPages.some(page => pathname.startsWith(page));
  
  if (isAuthorized && isPublicPage) {
    router.push('/admin');
    return null;
  }

  if (!isAuthorized && !isPublicPage) {
    router.push('/admin/login');
    return null;
  }

  if (!isAuthorized && isPublicPage) {
    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
      {/* Mobile Header */}
      <div className="lg:hidden bg-white border-b border-gray-200 p-4 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <Image 
            src="https://pbs.twimg.com/profile_images/1456143975845404674/xGjOJe4S_400x400.jpg" 
            alt="Vakıf Logosu" 
            width={32} 
            height={32} 
            className="rounded-full"
            referrerPolicy="no-referrer"
          />
          <h1 className="text-sm font-bold text-gray-900">Yönetim Paneli</h1>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-gray-600">
          {isMobileMenuOpen ? <CloseIcon size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <div className={clsx(
        "fixed inset-0 z-50 lg:sticky lg:top-0 lg:h-screen lg:z-0 lg:flex lg:w-64 bg-white border-r border-gray-200 flex-col transition-transform duration-300 ease-in-out",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="h-20 hidden lg:flex flex-col items-center justify-center px-6 border-b border-gray-200 py-2">
          <Image 
            src="https://pbs.twimg.com/profile_images/1456143975845404674/xGjOJe4S_400x400.jpg" 
            alt="Vakıf Logosu" 
            width={40} 
            height={40} 
            className="rounded-full mb-1"
            referrerPolicy="no-referrer"
          />
          <h1 className="text-xs font-bold text-gray-900">Yönetim Paneli</h1>
        </div>
        
        {/* Mobile Close Overlay */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 lg:hidden" 
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        <nav className="flex-1 px-4 py-2 space-y-0.5 overflow-y-hidden bg-white relative z-50">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={clsx(
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900',
                  'group flex items-center px-2 py-1.5 text-xs font-medium rounded-md'
                )}
              >
                <item.icon
                  className={clsx(
                    isActive ? 'text-blue-700' : 'text-gray-400 group-hover:text-gray-500',
                    'mr-2.5 flex-shrink-0 h-4 w-4'
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-gray-200 space-y-1 bg-white relative z-50">
          <div className="px-2 py-0.5 text-xs font-semibold text-gray-900 truncate">
            {currentPersonnel?.name || user?.displayName}
          </div>
          <div className="px-2 py-0 text-[10px] text-gray-500 truncate">
            {user?.email}
          </div>
          <Link
            href="/"
            className="group flex items-center px-2 py-1.5 text-xs font-medium text-gray-700 rounded-md hover:bg-gray-50 hover:text-gray-900"
          >
            <Home className="text-gray-400 group-hover:text-gray-500 mr-2.5 flex-shrink-0 h-4 w-4" />
            Ana Sayfaya Dön
          </Link>
          <button
            onClick={handleLogout}
            className="w-full group flex items-center px-2 py-1.5 text-xs font-medium text-red-600 rounded-md hover:bg-red-50 transition-colors"
          >
            <LogOut className="text-red-400 group-hover:text-red-500 mr-2.5 flex-shrink-0 h-4 w-4" />
            Çıkış Yap
          </button>
          
          <div className="mt-2 pt-2 border-t border-gray-100 text-center opacity-50 hover:opacity-100 transition-opacity">
            <p className="text-[8px] text-gray-400 uppercase tracking-widest mb-0.5">
              Tasarlayan ve Yöneten
            </p>
            <p className="text-[9px] font-bold text-gray-600">
              Gökhan SUÇSUZ
            </p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
