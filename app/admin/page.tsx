'use client';

import { useState, useEffect } from 'react';
import { useAppQuery } from '@/lib/hooks';
import { db as firestoreDb } from '@/lib/db';
import { format } from 'date-fns';
import { safeFormat, safeFormatTRT } from '@/lib/date-utils';
import { Truck, MapPin, CheckCircle, Clock, XCircle, ShoppingBasket, Users, AlertTriangle, ArrowRight } from 'lucide-react';
import { Route, RouteStop, Driver, Household, BreadTracking } from '@/lib/db';
import { toast } from 'sonner';
import Link from 'next/link';

export default function AdminDashboard() {
  const today = safeFormatTRT(new Date(), 'yyyy-MM-dd');
  
  const drivers = useAppQuery(() => firestoreDb.drivers.toArray(), [], 'drivers') || [];
  const households = useAppQuery(() => firestoreDb.households.toArray(), [], 'households') || [];
  const breadTracking = useAppQuery(() => firestoreDb.breadTracking.toArray(), [], 'bread_tracking') || [];
  const routes = useAppQuery(async () => {
    const allRoutes = await firestoreDb.routes.toArray();
    return allRoutes.filter(r => r.date === today || r.status === 'in_progress' || r.status === 'pending');
  }, [today], 'routes') || [];

  const routeStops = useAppQuery(async () => {
    if (routes.length === 0) return [];
    // Bulk fetch stops for all of today's routes to avoid N+1 query problem
    const routeIds = routes.map(r => r.id).filter(id => !!id) as string[];
    if (routeIds.length === 0) return [];
    return await firestoreDb.routeStops.where('routeId').anyOf(routeIds).toArray();
  }, [routes, today], 'today_route_stops') || [];

  const nextMonthObj = new Date();
  nextMonthObj.setMonth(nextMonthObj.getMonth() + 1);
  const nextMonthStr = safeFormat(nextMonthObj, 'yyyy-MM');
  const nextMonthConfig = useAppQuery(() => firestoreDb.working_days.where('month').equals(nextMonthStr).toArray(), [nextMonthStr], 'working_days_next_month') || [];

  const todayDate = new Date();
  const isAfter25th = todayDate.getDate() >= 25;
  const showWorkingDayWarning = isAfter25th && nextMonthConfig.length === 0;

  const todayBread = breadTracking.find(b => b.date === today);
  
  useEffect(() => {
    if (todayBread && todayBread.leftoverAmount > 0) {
      toast.warning(`Artan ekmek ${todayBread.leftoverAmount} adet. Sipariş miktarı güncellendi.`);
    }
  }, [todayBread]);
  
  const getDriverStatus = () => {
    if (!drivers.length) return [];

    return drivers.map(driver => {
      const route = routes.find(r => r.driverId === driver.id && r.status === 'in_progress') || 
                    routes.find(r => r.driverId === driver.id && r.date === today) ||
                    routes.find(r => r.driverId === driver.id && r.status === 'pending');
      
      if (!route) {
        return {
          routeId: '',
          driverId: driver.id,
          driverName: driver.name,
          vehiclePlate: driver.vehiclePlate,
          status: 'no_route',
          progress: 0,
          completedStops: 0,
          successfulCount: 0,
          successfulPeopleCount: 0,
          totalStops: 0,
          lastHousehold: '-',
          lastStopStatus: 'pending',
          lastStopIssue: '',
          lastDeliveryTime: '-',
          locationPermissionStatus: (driver as any).locationPermissionStatus || 'unknown',
          locationPermissionRequestPending: (driver as any).locationPermissionRequestPending || false,
        };
      }

      const stops = routeStops.filter((rs: RouteStop) => rs.routeId === route.id).sort((a: RouteStop, b: RouteStop) => a.order - b.order);
      
      // Filter out actually passive stops from status calculation if we want them "dropped" from totals
      // In generateRouteFromTemplate we set memberCount to 0 for passive ones
      const actualStops = stops.filter((s: RouteStop) => (s.householdSnapshotMemberCount || 0) > 0);
      
      const processedStops = actualStops.filter((s: RouteStop) => s.status === 'delivered' || s.status === 'failed');
      const successfulStops = actualStops.filter((s: RouteStop) => s.status === 'delivered');
      const lastStop = processedStops.length > 0 ? processedStops[processedStops.length - 1] : null;
      const lastHousehold = lastStop ? households.find(h => h.id === lastStop.householdId) : null;

      const totalStops = actualStops.length;
      const completedStops = processedStops.length;
      const successfulCount = successfulStops.length;
      const progress = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;
      const successfulPeopleCount = successfulStops.reduce((sum: number, s: RouteStop) => sum + (s.householdSnapshotMemberCount || 0), 0);

      return {
        routeId: route.id,
        driverId: driver.id,
        driverName: driver.name,
        vehiclePlate: driver.vehiclePlate,
        status: route.status,
        progress,
        completedStops,
        successfulCount,
        successfulPeopleCount,
        totalStops,
        lastHousehold: lastHousehold?.headName || '-',
        lastStopStatus: lastStop?.status || 'pending',
        lastStopIssue: lastStop?.issueReport || '',
        lastDeliveryTime: safeFormatTRT(lastStop?.deliveredAt, 'HH:mm'),
        locationPermissionStatus: (driver as any).locationPermissionStatus || 'unknown',
        locationPermissionRequestPending: (driver as any).locationPermissionRequestPending || false,
      };
    });
  };

  const driverStatuses = getDriverStatus();

  const requestLocationPermission = async (driverId: string) => {
    try {
      await firestoreDb.drivers.update(driverId, { locationPermissionRequestPending: true });
      toast.success('Şoföre konum izni bildirimi gönderildi.');
    } catch (e) {
      toast.error('Bildirim gönderilirken hata oluştu.');
    }
  };

  
  const activeHouseholds = households.filter(h => {
    if (!h.isActive) return false;
    if (h.pausedUntil && (h.pausedUntil >= today || h.pausedUntil === '9999-12-31')) return false;
    return true;
  });
  const totalHouseholdsOnly = activeHouseholds.filter(h => !h.type || h.type === 'household').length;
  const totalInstitutions = activeHouseholds.filter(h => h.type === 'institution').length;
  const totalPeople = activeHouseholds.reduce((sum: number, h: Household) => sum + (h.memberCount || 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 leading-none">Anlık Takip Paneli</h2>
        <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-sm font-bold border border-blue-100 flex items-center gap-2">
          <Clock size={16} />
          {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {showWorkingDayWarning && (
        <div className="mb-8 bg-amber-50 border-2 border-amber-200 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-500 shadow-sm shadow-amber-100">
          <div className="flex items-center gap-4 text-center md:text-left">
            <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl">
              <AlertTriangle size={32} />
            </div>
            <div>
              <h3 className="text-lg font-black text-amber-900">Çalışma Günleri Hatırlatması</h3>
              <p className="text-sm font-medium text-amber-700">Gelecek ay ({nextMonthStr}) için çalışma günleri henüz belirlenmemiş. Sistem varsayılan haftaiçi takvimini kullanacak fakat onayınız gereklidir.</p>
            </div>
          </div>
          <Link 
            href="/admin/working-days"
            className="w-full md:w-auto bg-amber-600 text-white px-8 py-3 rounded-2xl font-black hover:bg-amber-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-200 group"
          >
            Günleri Belirle
            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-indigo-100 text-indigo-600 mr-4">
              <Users size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Kayıtlı Hane / Kurum</p>
              <p className="text-2xl font-bold text-gray-900">{totalHouseholdsOnly} / {totalInstitutions}</p>
              <p className="text-[10px] text-gray-400 mt-1">Hane / Kurum Sayısı</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-teal-100 text-teal-600 mr-4">
              <Users size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Toplam Yemek (Kişi)</p>
              <p className="text-2xl font-bold text-gray-900">{totalPeople}</p>
              <p className="text-[10px] text-gray-400 mt-1">Hane + Kurum Toplamı</p>
            </div>
          </div>
        </div>
        {todayBread && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-orange-100 text-orange-600 mr-4">
                <ShoppingBasket size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Bugünkü Ekmek Siparişi</p>
                <p className="text-2xl font-bold text-gray-900">{todayBread.finalOrderAmount} Adet</p>
              </div>
            </div>
            {todayBread.leftoverAmount > 0 && (
              <div className="text-right">
                <p className="text-sm font-medium text-gray-500">Artan</p>
                <p className="text-lg font-bold text-orange-600">+{todayBread.leftoverAmount}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600 mr-4">
              <Truck size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Aktif Araçlar</p>
              <p className="text-2xl font-bold text-gray-900">
                {driverStatuses.filter(d => d.status === 'in_progress').length} / {driverStatuses.length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-indigo-100 text-indigo-600 mr-4">
              <MapPin size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Günlük Görevler</p>
              <p className="text-2xl font-bold text-gray-900">
                {driverStatuses.reduce((acc: number, curr: any) => acc + curr.totalStops, 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-amber-100 text-amber-600 mr-4">
              <Clock size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">İşlem Gören</p>
              <p className="text-2xl font-bold text-gray-900">
                {driverStatuses.reduce((acc: number, curr: any) => acc + curr.completedStops, 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600 mr-4">
              <CheckCircle size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Başarılı Teslimat</p>
              <p className="text-2xl font-bold text-gray-900">
                {driverStatuses.reduce((acc: number, curr: any) => acc + curr.successfulCount, 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <h3 className="text-lg font-bold text-gray-900 mb-4">Şoför Durumları</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {driverStatuses.map((status, idx) => (
          <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h4 className="font-bold text-gray-900 text-lg">{status.driverName}</h4>
                <p className="text-sm text-gray-500">{status.vehiclePlate}</p>
              </div>
              <div className="flex items-center gap-3">
                {status.locationPermissionStatus !== 'granted' && (
                  <button
                    onClick={() => requestLocationPermission(status.driverId!)}
                    disabled={status.locationPermissionRequestPending}
                    className="px-3 py-1.5 bg-amber-100 text-amber-800 text-xs font-bold rounded-xl hover:bg-amber-200 transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-sm border border-amber-200"
                  >
                    <MapPin size={12} />
                    {status.locationPermissionRequestPending ? 'İstek Gönderildi' : 'Konum İzni İste'}
                  </button>
                )}
                <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm ${
                  status.status === 'completed' ? 'bg-green-100 text-green-800 border-green-200 border' :
                  status.status === 'in_progress' ? 'bg-blue-100 text-blue-800 border-blue-200 border' :
                  status.status === 'no_route' ? 'bg-red-100 text-red-800 border-red-200 border' :
                  'bg-gray-100 text-gray-800 border-gray-200 border'
                }`}>
                  {status.status === 'completed' ? 'Tamamlandı' :
                   status.status === 'in_progress' ? 'Dağıtımda' : 
                   status.status === 'no_route' ? 'Rota Yok' : 'Bekliyor'}
                </span>
              </div>
            </div>
            <div className="p-5">
              {status.status === 'no_route' ? (
                <div className="text-center py-6 text-gray-500 italic">
                  Bugün için atanmış rota bulunmuyor.
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-2">
                      <span className="text-gray-500">Teslimat İlerlemesi</span>
                      <span className="text-blue-600">%{status.progress} Tamamlandı</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3 mb-2">
                      <div className="bg-blue-600 h-3 rounded-full transition-all duration-500" style={{ width: `${status.progress}%` }}></div>
                    </div>
                    <div className="flex items-center justify-between text-xs font-bold text-gray-600 bg-gray-50 p-2 rounded-lg">
                      <span>Tamamlanan: {status.completedStops} / {status.totalStops}</span>
                      <span>Kalan: {status.totalStops - status.completedStops}</span>
                    </div>
                  </div>
                  
                  {status.status === 'completed' ? (
                    <div className="bg-green-50 rounded-lg p-5 mt-4 flex flex-col items-center justify-center text-green-700 border border-green-100">
                      <div className="flex items-center mb-2">
                        <CheckCircle className="mr-2" size={24} />
                        <span className="font-black text-lg">Rota Başarıyla Tamamlandı</span>
                      </div>
                      <p className="text-sm font-medium text-center">
                        Bugün toplam <span className="font-bold underline">{status.successfulCount} hane</span> ve 
                        <span className="font-bold underline mx-1">{status.successfulPeopleCount} kişiye</span> 
                        başarıyla yemek teslimatı yapıldı.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-4 mt-4">
                      <p className="text-xs text-gray-500 uppercase font-semibold mb-2">En Son İşlem</p>
                      {status.lastHousehold !== '-' ? (
                        <div className="flex items-start">
                          {status.lastStopStatus === 'delivered' ? (
                            <CheckCircle className="text-green-500 mr-2 mt-0.5 flex-shrink-0" size={18} />
                          ) : (
                            <XCircle className="text-red-500 mr-2 mt-0.5 flex-shrink-0" size={18} />
                          )}
                          <div>
                            <p className="font-medium text-gray-900">{status.lastHousehold}</p>
                            {status.lastStopStatus === 'failed' && status.lastStopIssue && (
                              <p className="text-sm text-red-600 mt-1 font-medium">Sorun: {status.lastStopIssue}</p>
                            )}
                            <p className="text-sm text-gray-500 flex items-center mt-1">
                              <Clock size={14} className="mr-1" /> {status.lastDeliveryTime}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">Henüz işlem yapılmadı.</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        {driverStatuses.length === 0 && (
          <div className="col-span-2 bg-white p-8 text-center rounded-xl border border-gray-200">
            <p className="text-gray-500">Bugün için oluşturulmuş rota bulunmuyor.</p>
          </div>
        )}
      </div>
    </div>
  );
}
