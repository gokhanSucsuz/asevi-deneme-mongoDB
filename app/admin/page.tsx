'use client';

import { useState, useEffect } from 'react';
import { useAppQuery } from '@/lib/hooks';
import { db as firestoreDb } from '@/lib/db';
import { format } from 'date-fns';
import { safeFormat } from '@/lib/date-utils';
import { Truck, MapPin, CheckCircle, Clock, XCircle, ShoppingBasket, Users, AlertTriangle, ArrowRight } from 'lucide-react';
import { Route, RouteStop, Driver, Household, BreadTracking } from '@/lib/db';
import { toast } from 'sonner';
import Link from 'next/link';

export default function AdminDashboard() {
  const today = safeFormat(new Date(), 'yyyy-MM-dd');
  
  const drivers = useAppQuery(() => firestoreDb.drivers.toArray(), [], 'drivers') || [];
  const households = useAppQuery(() => firestoreDb.households.toArray(), [], 'households') || [];
  const breadTracking = useAppQuery(() => firestoreDb.breadTracking.toArray(), [], 'bread_tracking') || [];
  const routes = useAppQuery(() => firestoreDb.routes.where('date').equals(today).toArray(), [today], 'routes') || [];
  const routeStops = useAppQuery(() => firestoreDb.routeStops.toArray(), [], 'route_stops') || [];

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
    if (!drivers.length || !routeStops.length || !households.length) return [];

    return drivers.map(driver => {
      const route = routes.find(r => r.driverId === driver.id);
      
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
          totalStops: 0,
          lastHousehold: '-',
          lastStopStatus: 'pending',
          lastStopIssue: '',
          lastDeliveryTime: '-',
        };
      }

      const stops = routeStops.filter(rs => rs.routeId === route.id).sort((a, b) => a.order - b.order);
      
      const processedStops = stops.filter(s => s.status === 'delivered' || s.status === 'failed');
      const successfulStops = stops.filter(s => s.status === 'delivered');
      const lastStop = processedStops.length > 0 ? processedStops[processedStops.length - 1] : null;
      const lastHousehold = lastStop ? households.find(h => h.id === lastStop.householdId) : null;

      const totalStops = stops.length;
      const completedStops = processedStops.length;
      const successfulCount = successfulStops.length;
      const progress = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;

      return {
        routeId: route.id,
        driverId: driver.id,
        driverName: driver.name,
        vehiclePlate: driver.vehiclePlate,
        status: route.status,
        progress,
        completedStops,
        successfulCount,
        totalStops,
        lastHousehold: lastHousehold?.headName || '-',
        lastStopStatus: lastStop?.status || 'pending',
        lastStopIssue: lastStop?.issueReport || '',
        lastDeliveryTime: safeFormat(lastStop?.deliveredAt, 'HH:mm'),
      };
    });
  };

  const driverStatuses = getDriverStatus();
  
  const activeHouseholds = households.filter(h => h.isActive);
  const totalHouseholdsOnly = activeHouseholds.filter(h => !h.type || h.type === 'household').length;
  const totalInstitutions = activeHouseholds.filter(h => h.type === 'institution').length;
  const totalPeople = activeHouseholds.reduce((sum, h) => sum + (h.memberCount || 0), 0);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Anlık Takip Paneli</h2>

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
                {driverStatuses.reduce((acc, curr) => acc + curr.totalStops, 0)}
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
                {driverStatuses.reduce((acc, curr) => acc + curr.completedStops, 0)}
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
                {driverStatuses.reduce((acc, curr) => acc + curr.successfulCount, 0)}
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
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                status.status === 'completed' ? 'bg-green-100 text-green-800' :
                status.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                status.status === 'no_route' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {status.status === 'completed' ? 'Tamamlandı' :
                 status.status === 'in_progress' ? 'Dağıtımda' : 
                 status.status === 'no_route' ? 'Rota Yok' : 'Bekliyor'}
              </span>
            </div>
            <div className="p-5">
              {status.status === 'no_route' ? (
                <div className="text-center py-6 text-gray-500 italic">
                  Bugün için atanmış rota bulunmuyor.
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-500">İlerleme</span>
                      <span className="font-medium text-gray-900">{status.progress}% ({status.completedStops}/{status.totalStops})</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${status.progress}%` }}></div>
                    </div>
                  </div>
                  
                  {status.status === 'completed' ? (
                    <div className="bg-green-50 rounded-lg p-4 mt-4 flex items-center justify-center text-green-700">
                      <CheckCircle className="mr-2" size={20} />
                      <span className="font-medium">Başarıyla teslimat bitirildi</span>
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
