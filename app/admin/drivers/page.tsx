'use client';

import { useState } from 'react';
import { useAppQuery } from '@/lib/hooks';
import { db, Driver, Route, RouteStop } from '@/lib/db';
import { Plus, Edit2, Trash2, X, FileText, Download, Calendar, Eye, EyeOff } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { format, subMonths, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthProvider';
import { getTurkishPdf, addVakifLogo, addReportFooter } from '@/lib/pdfUtils';
import autoTable from 'jspdf-autotable';
import { maskSensitive, isValidTcNo } from '@/lib/validation';
import { safeFormat } from '@/lib/date-utils';
import { addSystemLog } from '@/lib/logger';

export default function DriversPage() {
  const { user, role, personnel } = useAuth();
  const isDemo = role === 'demo';
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [driverToReport, setDriverToReport] = useState<Driver | null>(null);
  const [reportRange, setReportRange] = useState('1');
  const [showSensitive, setShowSensitive] = useState<Record<string, boolean>>({});
  
  const drivers = useAppQuery(() => db.drivers.toArray(), [], 'drivers');
  const routes = useAppQuery(() => db.routes.toArray(), [], 'routes');
  const personnelName = personnel?.name || 'Bilinmeyen Personel';

  const addLog = async (action: string, details?: string) => {
    await addSystemLog(user, personnel, action, details, 'driver');
  };

  const { register, handleSubmit, reset } = useForm<Driver>({
    defaultValues: {
      tcNo: '',
      name: '',
      phone: '',
      vehiclePlate: '',
      isActive: true,
    }
  });

  const openModal = (driver?: Driver) => {
    if (driver) {
      setEditingId(driver.id!);
      reset(driver);
    } else {
      setEditingId(null);
      reset({
        tcNo: '',
        name: '',
        phone: '',
        vehiclePlate: '',
        isActive: true,
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const toggleSensitive = (id: string) => {
    setShowSensitive(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const onSubmit = async (data: Driver) => {
    const loadingToast = toast.loading('Kaydediliyor...');
    try {
      if (data.tcNo && !isValidTcNo(data.tcNo)) {
        toast.error('Geçersiz TC Kimlik Numarası.', { id: loadingToast });
        return;
      }

      // Uniqueness check for tcNo
      const duplicate = drivers?.find(d => d.tcNo === data.tcNo && d.id !== editingId);
      if (duplicate) {
        toast.error('Bu TC Kimlik No ile kayıtlı başka bir şoför var.', { id: loadingToast });
        return;
      }

      if (editingId) {
        await db.drivers.put({ ...data, id: editingId });
        await addLog('Şoför Güncellendi', `${data.name} şoförünün bilgileri güncellendi.`);
        toast.success('Şoför başarıyla güncellendi', { id: loadingToast });
      } else {
        await db.drivers.add(data);
        await addLog('Şoför Eklendi', `${data.name} şoförü sisteme eklendi.`);
        toast.success('Şoför başarıyla eklendi', { id: loadingToast });
      }
      closeModal();
    } catch (error) {
      console.error(error);
      toast.error('Kayıt sırasında bir hata oluştu', { id: loadingToast });
    }
  };

  const deleteDriver = async (id: string) => {
    if (confirm('Bu şoförü silmek istediğinize emin misiniz? Geçmiş istatistiklerde şoför adı görünmeye devam edecektir.')) {
      try {
        const driver = await db.drivers.get(id);
        await db.drivers.delete(id);
        if (driver) {
          await addLog('Şoför Silindi', `${driver.name} şoförü sistemden silindi.`);
        }
        toast.success('Şoför başarıyla silindi');
      } catch (error) {
        console.error(error);
        toast.error('Silme işlemi sırasında bir hata oluştu');
      }
    }
  };

  const openReportModal = (driver: Driver) => {
    setDriverToReport(driver);
    setReportModalOpen(true);
  };

  const getDriverRoutes = (driverId: string | undefined) => {
    if (!driverId) return [];
    return routes?.filter(r => String(r.driverId) === String(driverId) && r.status === 'completed').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) || [];
  };

  const exportDriverReportPDF = async () => {
    if (!driverToReport) return;
    const loadingToast = toast.loading('Rapor hazırlanıyor...');
    
    try {
      const doc = await getTurkishPdf('portrait');
      const months = parseInt(reportRange);
      const endDate = new Date();
      const startDate = subMonths(endDate, months);

      const driverRoutes = routes?.filter((r: Route) => 
        String(r.driverId) === String(driverToReport.id!) && 
        r.status === 'completed' &&
        isWithinInterval(new Date(r.date), { start: startOfDay(startDate), end: endOfDay(endDate) })
      ).sort((a: Route, b: Route) => new Date(b.date).getTime() - new Date(a.date).getTime()) || [];

      const allStops = await db.routeStops.toArray();
      const driverStops = allStops.filter((s: RouteStop) => driverRoutes.some((r: Route) => String(r.id) === String(s.routeId)));

      const totalKm = driverRoutes.reduce((acc: number, r: Route) => acc + ((r.endKm || 0) - (r.startKm || 0)), 0);
      const totalDelivered = driverStops.filter((s: RouteStop) => s.status === 'delivered').length;
      const totalFailed = driverStops.filter((s: RouteStop) => s.status === 'failed').length;

      await addVakifLogo(doc, 14, 10, 20);

      doc.setFontSize(14);
      doc.text('Sosyal Yardımlaşma ve Dayanışma Vakfı Başkanlığı', 40, 18);
      doc.setFontSize(12);
      doc.text(`${driverToReport.name} - Şoför Performans Raporu`, 40, 25);
      doc.setFontSize(10);
      doc.text(`Araç Plakası: ${driverToReport.vehiclePlate}`, 40, 31);
      doc.text(`Dönem: ${safeFormat(startDate, 'dd.MM.yyyy')} - ${safeFormat(endDate, 'dd.MM.yyyy')} (${months} Ay)`, 40, 37);
      doc.text(`Rapor Tarihi: ${safeFormat(new Date(), 'dd.MM.yyyy HH:mm')}`, 40, 43);

      // Summary Table
      autoTable(doc, {
        head: [['Toplam KM', 'Başarılı Teslimat', 'Başarısız Teslimat', 'Toplam Rota']],
        body: [[totalKm, totalDelivered, totalFailed, driverRoutes.length]],
        startY: 50,
        styles: { font: 'Roboto', fontSize: 10, halign: 'center' },
        headStyles: { font: 'Roboto', fontStyle: 'bold', fillColor: [41, 128, 185] }
      });

      // Detailed Table
      const tableColumn = ["Tarih", "KM", "Başarılı", "Başarısız", "Kalan Y/E"];
      const tableRows = driverRoutes.map((route: Route) => {
        const routeStops = driverStops.filter((s: RouteStop) => s.routeId === route.id);
        const delivered = routeStops.filter((s: RouteStop) => s.status === 'delivered').length;
        const failed = routeStops.filter((s: RouteStop) => s.status === 'failed').length;
        return [
          safeFormat(new Date(route.date), 'dd.MM.yyyy'),
          (route.endKm && route.startKm) ? (route.endKm - route.startKm) : '-',
          delivered,
          failed,
          `${route.remainingFood || 0} / ${route.remainingBread || 0}`
        ];
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: (doc as any).lastAutoTable.finalY + 10,
        styles: { font: 'Roboto', fontSize: 9 },
        headStyles: { font: 'Roboto', fontStyle: 'bold', fillColor: [52, 73, 94] }
      });

      // Failed Deliveries Explanations
      const failedStops = driverStops.filter((s: RouteStop) => s.status === 'failed' && s.issueReport);
      if (failedStops.length > 0) {
        doc.addPage();
        await addVakifLogo(doc, 14, 10, 20);
        doc.setFontSize(12);
        doc.text('Başarısız Teslimat Gerekçeleri', 40, 25);
        
        const failedTableColumn = ["Tarih", "Hane", "Gerekçe"];
        const failedTableRows = failedStops.map((stop: RouteStop) => {
          const route = driverRoutes.find((r: Route) => r.id === stop.routeId);
          return [
            route ? safeFormat(new Date(route.date), 'dd.MM.yyyy') : '-',
            stop.householdSnapshotName || '-',
            stop.issueReport || '-'
          ];
        });

        autoTable(doc, {
          head: [failedTableColumn],
          body: failedTableRows,
          startY: 35,
          styles: { font: 'Roboto', fontSize: 9 },
          headStyles: { font: 'Roboto', fontStyle: 'bold', fillColor: [192, 57, 43] }
        });
      }

      addReportFooter(doc, personnelName);
      doc.save(`Sofor_Performans_${driverToReport.name.replace(/\s+/g, '_')}.pdf`);
      toast.success('Rapor başarıyla oluşturuldu', { id: loadingToast });
      setReportModalOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('Rapor oluşturulurken bir hata oluştu', { id: loadingToast });
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Şoförler ve Araçlar</h2>
        {!isDemo && (
          <button
            onClick={() => openModal()}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center"
          >
            <Plus size={20} className="mr-2" />
            Yeni Şoför Ekle
          </button>
        )}
      </div>

      <div className="bg-white shadow-sm rounded-lg overflow-x-auto border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TC Kimlik No</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ad Soyad</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telefon</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Araç Plakası</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">İşlemler</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {drivers?.map((driver) => (
              <tr key={driver.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    {showSensitive[driver.id!] ? driver.tcNo : maskSensitive(driver.tcNo)}
                    {driver.tcNo && (
                      <button onClick={() => toggleSensitive(driver.id!)} className="text-gray-400 hover:text-blue-600">
                        {showSensitive[driver.id!] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{driver.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {showSensitive[driver.id!] ? driver.phone : maskSensitive(driver.phone, 4)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{driver.vehiclePlate}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${driver.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {driver.isActive ? 'Aktif' : 'Pasif'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button onClick={() => openReportModal(driver)} className="text-gray-600 hover:text-gray-900 mr-4" title="Rapor">
                    <FileText size={18} />
                  </button>
                  {!isDemo && (
                    <>
                      <button onClick={() => openModal(driver)} className="text-blue-600 hover:text-blue-900 mr-4" title="Düzenle">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => deleteDriver(driver.id!)} className="text-red-600 hover:text-red-900" title="Sil">
                        <Trash2 size={18} />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {drivers?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                  Henüz şoför eklenmemiş.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {reportModalOpen && driverToReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {driverToReport.name} - Detaylı Rapor
              </h3>
              <button onClick={() => setReportModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto">
              <div className="mb-6 grid grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">Araç Plakası</p>
                  <p className="font-bold text-gray-900">{driverToReport.vehiclePlate}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">Toplam Rota</p>
                  <p className="font-bold text-gray-900">{getDriverRoutes(driverToReport.id!).length}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rapor Dönemi</label>
                  <select
                    value={reportRange}
                    onChange={(e) => setReportRange(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-1"
                  >
                    <option value="1">Son 1 Ay</option>
                    <option value="3">Son 3 Ay</option>
                    <option value="6">Son 6 Ay</option>
                  </select>
                </div>
              </div>
              
              <h4 className="font-bold text-gray-900 mb-4">Günlük KM ve Rota Kayıtları</h4>
              <div className="bg-white shadow-sm rounded-lg overflow-x-auto border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarih</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Başlangıç KM</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bitiş KM</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Yapılan KM</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kalan Yemek/Ekmek</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {getDriverRoutes(driverToReport.id!).map((route) => (
                      <tr key={route.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {safeFormat(new Date(route.date), 'dd.MM.yyyy')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{route.startKm || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{route.endKm || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                          {(route.endKm && route.startKm) ? (route.endKm - route.startKm) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {route.remainingFood || 0} / {route.remainingBread || 0}
                        </td>
                      </tr>
                    ))}
                    {getDriverRoutes(driverToReport.id!).length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                          Henüz tamamlanmış rota kaydı bulunmuyor.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
              <button
                onClick={() => setReportModalOpen(false)}
                className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Kapat
              </button>
              <button
                onClick={exportDriverReportPDF}
                className="bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 flex items-center text-sm font-medium"
              >
                <Download size={16} className="mr-2" />
                PDF İndir
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {editingId ? 'Şoför Düzenle' : 'Yeni Şoför Ekle'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-500">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">TC Kimlik No</label>
                <input
                  type="text"
                  {...register('tcNo', { required: true })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                  placeholder="11 haneli TC No"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Ad Soyad</label>
                <input
                  type="text"
                  {...register('name', { required: true })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Telefon</label>
                <input
                  type="text"
                  {...register('phone', { required: true })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Araç Plakası</label>
                <input
                  type="text"
                  {...register('vehiclePlate', { required: true })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  {...register('isActive')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-900">
                  Aktif
                </label>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
