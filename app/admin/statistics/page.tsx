'use client';

import { useAppQuery } from '@/lib/hooks';
import { db } from '@/lib/db';
import { format, startOfMonth, endOfMonth, isWithinInterval, startOfWeek, endOfWeek } from 'date-fns';
import { BarChart as BarChartIcon, Users, Truck, CheckCircle, XCircle, FileText } from 'lucide-react';
import { getTurkishPdf, addVakifLogo, addReportFooter } from '@/lib/pdfUtils';
import autoTable from 'jspdf-autotable';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

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
  const { user } = useAuth();
  const routes = useAppQuery(() => db.routes.toArray(), [], 'routes');
  const routeStops = useAppQuery(() => db.routeStops.toArray(), [], 'route_stops');
  const drivers = useAppQuery(() => db.drivers.toArray(), [], 'drivers');
  const households = useAppQuery(() => db.households.toArray(), [], 'households');
  const personnelList = useAppQuery(() => db.personnel.toArray(), [], 'personnel');
  const breadTracking = useAppQuery(() => db.breadTracking.toArray(), [], 'bread_tracking');
  const leftoverFood = useAppQuery(() => db.leftover_food.toArray(), [], 'leftover_food');

  if (!routes || !routeStops || !drivers || !households || !breadTracking || !leftoverFood) {
    return <div className="p-8 text-center text-gray-500">Yükleniyor...</div>;
  }

  const currentPersonnel = personnelList?.find(p => p.email === user?.email);
  const personnelName = currentPersonnel?.name || user?.displayName || user?.email || 'Bilinmeyen Personel';

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
      doc.text(`Rapor Tarihi: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, doc.internal.pageSize.width - 14, 22, { align: 'right' });
      
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

      autoTable(doc, {
        head: [['Kategori', 'Değer']],
        body: summaryData,
        startY: 45,
        theme: 'grid',
        styles: { font: 'Roboto', fontSize: 10 },
        headStyles: { fillColor: [79, 70, 229] }
      });

      addReportFooter(doc, personnelName);
      doc.save(`Asevi_Genel_Istatistikler_${format(new Date(), 'dd_MM_yyyy')}.pdf`);
      toast.success('Rapor başarıyla oluşturuldu', { id: loadingToast });
    } catch (error) {
      console.error(error);
      toast.error('Rapor oluşturulurken bir hata oluştu', { id: loadingToast });
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Genel İstatistikler</h2>
        <button onClick={exportToPDF} className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700">PDF İndir</button>
      </div>

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
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={foodDistributionData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={renderCustomizedLabel} labelLine={false}>
                {foodDistributionData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(value: any, name: any) => [`${value} Porsiyon`, name]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold mb-4 text-gray-800">Ekmek Dağılımı (Hane vs Kurum)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={breadDistributionData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={renderCustomizedLabel} labelLine={false}>
                {breadDistributionData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(value: any, name: any) => [`${value} Adet`, name]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold mb-4 text-gray-800">Teslimat Şekli (Yemek)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={deliveryTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={renderCustomizedLabel} labelLine={false}>
                {deliveryTypeData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(value: any, name: any) => [`${value} Porsiyon`, name]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold mb-4 text-gray-800">Kap Kullanımı (Yemek)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={containerTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={renderCustomizedLabel} labelLine={false}>
                {containerTypeData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(value: any, name: any) => [`${value} Porsiyon`, name]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
