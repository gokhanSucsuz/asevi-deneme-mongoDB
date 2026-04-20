'use client';

import { useState, useEffect, useRef } from 'react';
import { useAppQuery } from '@/lib/hooks';
import { db } from '@/lib/db';
import { format, startOfMonth, endOfMonth, isWithinInterval, startOfWeek, endOfWeek } from 'date-fns';
import { BarChart as BarChartIcon, Users, Truck, CheckCircle, XCircle, FileText } from 'lucide-react';
import { addReportFooter, addVakifLogo, getTurkishPdf } from '@/lib/pdfUtils';
import autoTable from 'jspdf-autotable';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { addSystemLog } from '@/lib/logger';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { safeFormat } from '@/lib/date-utils';
import { toPng } from 'html-to-image';

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, value }: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text x={x} y={y} fill="#1f2937" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-[10px] font-bold">
      {`${value} (${(percent * 100).toFixed(0)}%)`}
    </text>
  );
};

export default function StatisticsPage() {
  const { user, personnel } = useAuth();
  const routes = useAppQuery(() => db.routes.toArray(), [], 'routes');
  const routeStops = useAppQuery(() => db.routeStops.toArray(), [], 'route_stops');
  const drivers = useAppQuery(() => db.drivers.toArray(), [], 'drivers');
  const households = useAppQuery(() => db.households.toArray(), [], 'households');
  const personnelList = useAppQuery(() => db.personnel.toArray(), [], 'personnel');
  const breadTracking = useAppQuery(() => db.breadTracking.toArray(), [], 'bread_tracking');
  const leftoverFood = useAppQuery(() => db.leftover_food.toArray(), [], 'leftover_food');

  const [isMounted, setIsMounted] = useState(false);
  const [timeGroup, setTimeGroup] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  if (!routes || !routeStops || !drivers || !households || !breadTracking || !leftoverFood || !isMounted) {
    return <div className="p-8 text-center text-gray-500">Yükleniyor...</div>;
  }

  const activePersonnelName = personnel?.name || 'Bilinmeyen Personel';

  // Metrics calculation
  const completedRoutes = routes.filter(r => r.status === 'completed' || r.status === 'approved');
  const deliveredStops = routeStops.filter(rs => rs.status === 'delivered');
  const totalFailedStops = routeStops.filter(rs => rs.status === 'failed');
  
  const activeHouseholds = households.filter(h => h.isActive);
  const selfServiceHouseholdsCount = activeHouseholds.filter(h => h.isSelfService).length;
  const ownContainerHouseholdsCount = activeHouseholds.filter(h => h.usesOwnContainer).length;
  const activeInstitutionsCount = activeHouseholds.filter(h => h.type === 'institution').length;
  const activeHouseholdsCount = activeHouseholds.filter(h => !h.type || h.type === 'household').length;

  let totalDeliveredFood = 0;
  let totalInstitutionFood = 0;
  let totalInstitutionBread = 0;
  let totalHouseholdFood = 0;
  let totalHouseholdBread = 0;

  deliveredStops.forEach(stop => {
    const household = households.find(h => h.id === stop.householdId);
    const count = stop.householdSnapshotMemberCount || household?.memberCount || 0;
    const breadCount = stop.householdSnapshotBreadCount ?? household?.breadCount ?? count;
    
    totalDeliveredFood += count;

    if (household?.type === 'institution') {
      totalInstitutionFood += count;
      totalInstitutionBread += breadCount;
    } else {
      totalHouseholdFood += count;
      totalHouseholdBread += breadCount;
    }
  });

  const routeDeliveredMeals = deliveredStops
    .filter(rs => {
      const route = routes.find(r => r.id === rs.routeId);
      return route && route.driverId !== 'vakif_pickup';
    })
    .reduce((sum, rs) => sum + (rs.householdSnapshotMemberCount || 0), 0);
    
  const selfServiceDeliveredMeals = deliveredStops
    .filter(rs => {
      const route = routes.find(r => r.id === rs.routeId);
      return route && route.driverId === 'vakif_pickup';
    })
    .reduce((sum, rs) => sum + (rs.householdSnapshotMemberCount || 0), 0);

  const approvedRoutes = routes.filter(r => r.status === 'approved');
  const approvedRouteIds = approvedRoutes.map(r => r.id);
  
  const totalDeliveredBread = routeStops
    .filter(rs => approvedRouteIds.includes(rs.routeId) && rs.status === 'delivered')
    .reduce((sum, rs) => sum + (rs.householdSnapshotBreadCount || 0), 0);

  const totalLeftoverBread = routes
    .filter(r => r.date >= '2026-04-14')
    .reduce((sum, r) => sum + (r.remainingBread || 0), 0);
    
  const totalLeftoverFood = leftoverFood.reduce((sum, f) => sum + f.quantity, 0);

  // Graph Data
  const foodDistributionData = [
    { name: 'Hane', value: totalHouseholdFood },
    { name: 'Kurum', value: totalInstitutionFood },
  ].filter(d => d.value > 0);
  
  const breadDistributionData = [
    { name: 'Hane', value: totalHouseholdBread },
    { name: 'Kurum', value: totalInstitutionBread },
  ].filter(d => d.value > 0);

  const deliveryTypeData = [
    { name: 'Vakıftan Alanlar', value: selfServiceDeliveredMeals },
    { name: 'Adrese Teslim', value: routeDeliveredMeals },
  ].filter(d => d.value > 0);

  // Container Data (Frozen if possible)
  let totalVakifContainers = breadTracking.reduce((sum, b) => sum + (b.containerCount || 0), 0);
  let totalOwnContainers = breadTracking.reduce((sum, b) => sum + (b.ownContainerCount || 0), 0);

  // If no bread tracking records exist, fallback to current active households (for new systems)
  if (totalVakifContainers === 0 && totalOwnContainers === 0) {
    totalOwnContainers = activeHouseholds.reduce((sum, h) => {
      if (h.usesOwnContainer) {
        return sum + (h.memberCount || 0);
      }
      return sum;
    }, 0);

    const totalActivePeople = activeHouseholds.reduce((sum, h) => sum + (h.memberCount || 0), 0);
    totalVakifContainers = totalActivePeople - totalOwnContainers;
  }

  const containerTypeData = [
    { name: 'Kendi Kabı', value: totalOwnContainers },
    { name: 'Vakıf Kabı', value: totalVakifContainers },
  ].filter(d => d.value > 0);

  const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  const exportToPDF = async () => {
    const loadingToast = toast.loading('İstatistik raporu hazırlanıyor...');
    try {
      const doc = await getTurkishPdf('portrait');
      await addVakifLogo(doc, 14, 10, 20);

      doc.setFontSize(12);
      doc.setFont('Roboto', 'bold');
      doc.text('T.C.', doc.internal.pageSize.width / 2, 15, { align: 'center' });
      doc.text('SOSYAL YARDIMLAŞMA VE DAYANIŞMA VAKFI BAŞKANLIĞI', doc.internal.pageSize.width / 2, 22, { align: 'center' });
      
      doc.setFontSize(14);
      doc.text('AŞEVİ GENEL İSTATİSTİK RAPORU', doc.internal.pageSize.width / 2, 35, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setFont('Roboto', 'normal');
      doc.text(`Rapor Tarihi: ${safeFormat(new Date(), 'dd.MM.yyyy HH:mm')}`, doc.internal.pageSize.width - 14, 15, { align: 'right' });
      
      const summaryData = [
        ['Toplam Yemek (Porsiyon)', `${totalDeliveredFood}`],
        ['Toplam Ekmek', `${totalDeliveredBread}`],
        ['Artan Yemek (Porsiyon)', `${totalLeftoverFood}`],
        ['Artan Ekmek', `${totalLeftoverBread}`],
        ['Vakıftan Alanlar (Kişi)', `${selfServiceHouseholdsCount}`],
        ['Kendi Kabını Kullananlar', `${ownContainerHouseholdsCount}`],
        ['Aktif Kurum Sayısı', `${activeInstitutionsCount}`],
        ['Aktif Hane Sayısı', `${activeHouseholdsCount}`]
      ];

      // 2. SUMMARY TABLE (Professional Grid)
      autoTable(doc, {
        head: [['Aşevi Operasyonel Parametreler', 'Mevcut Değer / Miktar']],
        body: summaryData,
        startY: 45,
        theme: 'grid',
        margin: { bottom: 20 },
        styles: { font: 'Roboto', fontSize: 10, cellPadding: 4 },
        headStyles: { fillColor: [79, 70, 229], halign: 'center' },
        columnStyles: { 
          0: { cellWidth: 100, fontStyle: 'bold' },
          1: { halign: 'right' }
        }
      });

      // 3. GRAPHICAL ANALYSIS (Individual items for readability)
      if (chartRef.current) {
        try {
          doc.addPage();
          let currentY = 20;

          doc.setFont('Roboto', 'bold');
          doc.setFontSize(14);
          doc.text('GÖRSEL VERİ ANALİZİ VE TRENDLER', doc.internal.pageSize.width / 2, currentY, { align: 'center' });
          currentY += 15;

          const chartSections = chartRef.current.querySelectorAll('.grid-cols-1 > div, .mt-8');

          for (let i = 0; i < chartSections.length; i++) {
            const section = chartSections[i] as HTMLElement;
            
            if (section.classList.contains('grid-cols-1') && section.querySelectorAll('p').length > 4) continue;

            const originalStyle = section.getAttribute('style') || '';
            section.setAttribute('style', originalStyle + '; background-color: white !important; border: none !important; box-shadow: none !important;');

            const imgData = await toPng(section, { 
              quality: 0.95,
              backgroundColor: '#ffffff',
              pixelRatio: 2
            });

            section.setAttribute('style', originalStyle);

            const img = new Image();
            img.src = imgData;
            await new Promise((resolve) => { img.onload = resolve; });

            const pageWidth = doc.internal.pageSize.width - 28;
            let imgWidth = pageWidth;
            let imgHeight = (img.height * imgWidth) / img.width;

            if (currentY + imgHeight > doc.internal.pageSize.height - 30) {
              doc.addPage();
              currentY = 20;
              doc.setFontSize(10);
              doc.setFont('Roboto', 'bold');
              doc.text('GÖRSEL ANALİZ (Devamı)', 14, currentY);
              currentY += 12;
            }

            doc.addImage(imgData, 'PNG', 14, currentY, imgWidth, imgHeight);
            currentY += imgHeight + 15;
          }
        } catch (chartError) {
          console.error('Error capturing individual charts for Statistics PDF:', chartError);
        }
      }

      addReportFooter(doc, activePersonnelName);
      await addSystemLog(user, personnel, 'Rapor İndirme', 'Genel Aşevi Dağıtım İstatistikleri (PDF) indirildi.', 'report');
      doc.save(`Asevi_Genel_Istatistikler_${safeFormat(new Date(), 'dd_MM_yyyy')}.pdf`);
      toast.success('Rapor başarıyla oluşturuldu', { id: loadingToast });
    } catch (error) {
      console.error(error);
      toast.error('Rapor oluşturulurken bir hata oluştu', { id: loadingToast });
    }
  };

  // Time Series Aggregation
  const timeSeriesData: Record<string, { name: string, y: number, food: number, bread: number }> = {};
  
  const getGroupKey = (dateStr: string) => {
    const d = new Date(dateStr);
    if (timeGroup === 'weekly') {
      const start = startOfWeek(d, { weekStartsOn: 1 });
      return safeFormat(start, 'dd MMM yyyy') + ' Haftası';
    } else if (timeGroup === 'monthly') {
      const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
      return months[d.getMonth()] + ' ' + d.getFullYear();
    } else {
      return d.getFullYear().toString();
    }
  };

  deliveredStops.forEach(stop => {
    const route = routes.find(r => r.id === stop.routeId);
    if (!route?.date) return;
    
    const key = getGroupKey(route.date);
    if (!timeSeriesData[key]) {
      timeSeriesData[key] = { name: key, y: new Date(route.date).getTime(), food: 0, bread: 0 };
    }
    
    const household = households.find(h => h.id === stop.householdId);
    const count = stop.householdSnapshotMemberCount || household?.memberCount || 0;
    const breadCount = stop.householdSnapshotBreadCount ?? household?.breadCount ?? count;
    
    timeSeriesData[key].food += count;
    timeSeriesData[key].bread += breadCount;
  });

  const chartData = Object.values(timeSeriesData).sort((a, b) => a.y - b.y);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Genel İstatistikler</h2>
        <button onClick={exportToPDF} className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700">PDF İndir</button>
      </div>

      <div ref={chartRef} className="p-2 -m-2 bg-transparent">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Toplam Yemek (Porsiyon)</h3>
          <p className="text-3xl font-black text-gray-900">{totalDeliveredFood}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Toplam Ekmek</h3>
          <p className="text-3xl font-black text-gray-900">{totalDeliveredBread}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Artan Yemek (Porsiyon)</h3>
          <p className="text-3xl font-black text-orange-600">{totalLeftoverFood}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Artan Ekmek</h3>
          <p className="text-3xl font-black text-orange-600">{totalLeftoverBread}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Vakıftan Alanlar (Kişi)</h3>
          <p className="text-3xl font-black text-purple-600">{selfServiceHouseholdsCount}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Kendi Kabını Kullananlar</h3>
          <p className="text-3xl font-black text-teal-600">{ownContainerHouseholdsCount}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Aktif Kurum Sayısı</h3>
          <p className="text-3xl font-black text-blue-600">{activeInstitutionsCount}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Aktif Hane Sayısı</h3>
          <p className="text-3xl font-black text-indigo-600">{activeHouseholdsCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold mb-4 text-gray-800">Yemek Dağılımı (Hane vs Kurum)</h3>
          <div className="h-[300px] w-full">
            {foodDistributionData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={foodDistributionData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={renderCustomizedLabel} labelLine={false}>
                    {foodDistributionData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value: any, name: any) => [`${value} Porsiyon`, name]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-gray-400">Veri yok</div>
            )}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold mb-4 text-gray-800">Ekmek Dağılımı (Hane vs Kurum)</h3>
          <div className="h-[300px] w-full">
            {breadDistributionData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={breadDistributionData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={renderCustomizedLabel} labelLine={false}>
                    {breadDistributionData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value: any, name: any) => [`${value} Adet`, name]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-gray-400">Veri yok</div>
            )}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold mb-4 text-gray-800">Teslimat Şekli (Yemek)</h3>
          <div className="h-[300px] w-full">
            {deliveryTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={deliveryTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={renderCustomizedLabel} labelLine={false}>
                    {deliveryTypeData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value: any, name: any) => [`${value} Porsiyon`, name]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-gray-400">Veri yok</div>
            )}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold mb-4 text-gray-800">Kap Kullanımı (Yemek)</h3>
          <div className="h-[300px] w-full">
            {containerTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={containerTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={renderCustomizedLabel} labelLine={false}>
                    {containerTypeData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value: any, name: any) => [`${value} Porsiyon`, name]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-gray-400">Veri yok</div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-gray-800">Zaman İçinde Teslimat Analizi</h3>
          <div className="flex border rounded-lg overflow-hidden text-sm">
            <button 
              onClick={() => setTimeGroup('weekly')}
              className={`px-4 py-2 ${timeGroup === 'weekly' ? 'bg-blue-600 text-white font-medium' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
            >
              Haftalık
            </button>
            <button 
              onClick={() => setTimeGroup('monthly')}
              className={`px-4 py-2 border-l border-r ${timeGroup === 'monthly' ? 'bg-blue-600 text-white font-medium' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
            >
              Aylık
            </button>
            <button 
              onClick={() => setTimeGroup('yearly')}
              className={`px-4 py-2 ${timeGroup === 'yearly' ? 'bg-blue-600 text-white font-medium' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
            >
              Yıllık
            </button>
          </div>
        </div>
        
        <div className="h-[400px] w-full min-h-[400px]">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={400}>
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any, name: any) => [value, name === 'food' ? 'Dağıtılan Yemek' : 'Dağıtılan Ekmek']}
                />
                <Legend />
                <Bar dataKey="food" name="Yemek Porsiyonu" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="bread" name="Ekmek" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full w-full flex items-center justify-center text-gray-400">
              Bu zaman dilimi için yeterli veri bulunamadı.
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
