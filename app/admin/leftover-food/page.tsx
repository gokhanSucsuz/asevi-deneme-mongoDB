'use client';

import { useState, useEffect } from 'react';
import { db, LeftoverFood } from '@/lib/db';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { toast } from 'sonner';
import { Save, FileText, Calendar as CalendarIcon } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getTurkishPdf, addVakifLogo, addReportFooter } from '@/lib/pdfUtils';
import { safeFormat } from '@/lib/date-utils';
import { addSystemLog } from '@/lib/logger';

export default function LeftoverFoodPage() {
  const { user, role, personnel } = useAuth();
  const isDemo = role === 'demo';
  const [date, setDate] = useState(safeFormat(new Date(), 'yyyy-MM-dd'));
  const [quantity, setQuantity] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [records, setRecords] = useState<LeftoverFood[]>([]);
  const [reportType, setReportType] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  useEffect(() => {
    fetchRecords();
  }, []);

  useEffect(() => {
    const todayRecord = records.find(r => r.date === date);
    if (todayRecord) {
      setQuantity(todayRecord.quantity);
      setNotes(todayRecord.notes || '');
    } else {
      setQuantity(0);
      setNotes('');
    }
  }, [date, records]);

  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      const data = await db.leftover_food.toArray();
      setRecords(data.sort((a, b) => b.date.localeCompare(a.date)));
    } catch (error) {
      console.error(error);
      toast.error('Kayıtlar yüklenirken bir hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const existingRecord = records.find(r => r.date === date);
      
      const data: LeftoverFood = {
        date,
        quantity,
        notes,
        updatedAt: new Date(),
        updatedBy: personnel?.name || user?.displayName || user?.email || 'Bilinmeyen Kullanıcı'
      };

      if (existingRecord && existingRecord.id) {
        await db.leftover_food.update(existingRecord.id, data);
        await addSystemLog(user, personnel, 'Artan Yemek Güncellendi', `${date} tarihli artan yemek kaydı güncellendi: ${quantity} porsiyon.`, 'leftover_food');
      } else {
        await db.leftover_food.add(data);
        await addSystemLog(user, personnel, 'Artan Yemek Eklendi', `${date} tarihi için artan yemek kaydı eklendi: ${quantity} porsiyon.`, 'leftover_food');
      }

      toast.success('Kayıt başarıyla kaydedildi');
      fetchRecords();
    } catch (error) {
      console.error(error);
      toast.error('Kaydedilirken bir hata oluştu');
    } finally {
      setIsSaving(false);
    }
  };

  const generatePDF = async () => {
    const doc = new jsPDF();
    const today = new Date();
    let filteredRecords = records;
    let title = 'Artan Yemek Raporu';

    if (reportType === 'daily') {
      filteredRecords = records.filter(r => r.date === safeFormat(today, 'yyyy-MM-dd'));
      title = `Günlük Artan Yemek Raporu (${safeFormat(today, 'dd.MM.yyyy')})`;
    } else if (reportType === 'weekly') {
      const start = startOfWeek(today, { weekStartsOn: 1 });
      const end = endOfWeek(today, { weekStartsOn: 1 });
      filteredRecords = records.filter(r => isWithinInterval(parseISO(r.date), { start, end }));
      title = `Haftalık Artan Yemek Raporu (${safeFormat(start, 'dd.MM.yyyy')} - ${safeFormat(end, 'dd.MM.yyyy')})`;
    } else if (reportType === 'monthly') {
      const start = startOfMonth(today);
      const end = endOfMonth(today);
      filteredRecords = records.filter(r => isWithinInterval(parseISO(r.date), { start, end }));
      title = `Aylık Artan Yemek Raporu (${safeFormat(today, 'MMMM yyyy')})`;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(title, 14, 20);

    const tableData = filteredRecords.map(r => [
      safeFormat(parseISO(r.date), 'dd.MM.yyyy'),
      r.quantity.toString(),
      r.notes || '-',
      r.updatedBy
    ]);

    autoTable(doc, {
      startY: 30,
      head: [['Tarih', 'Miktar (Porsiyon)', 'Notlar', 'Kaydeden']],
      body: tableData,
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 10 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      headStyles: { fillColor: [41, 128, 185] }
    });

    const totalQuantity = filteredRecords.reduce((sum, r) => sum + r.quantity, 0);
    const finalY = (doc as any).lastAutoTable.finalY || 30;
    
    doc.setFont('helvetica', 'bold');
    doc.text(`Toplam Artan Yemek: ${totalQuantity} Porsiyon`, 14, finalY + 10);
    
    const personnelName = personnel?.name || 'Bilinmeyen Personel';
    addReportFooter(doc, personnelName);

    await addSystemLog(user, personnel, 'Rapor İndirme', `${reportType === 'monthly' ? 'Aylık' : reportType === 'weekly' ? 'Haftalık' : 'Günlük'} Artan Yemek Raporu (PDF) indirildi.`, 'report');
    doc.save(`artan_yemek_raporu_${safeFormat(today, 'yyyy-MM-dd')}.pdf`);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Artan Yemek Takibi</h1>
          <p className="text-gray-500 mt-1">Günlük mutfaktan artan yemek miktarını girin.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tarih</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Artan Yemek (Porsiyon)</label>
            <input
              type="number"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notlar (İsteğe Bağlı)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Eklemek istediğiniz notlar..."
            />
          </div>
        </div>

        {!isDemo && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Save size={20} />
              {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h2 className="text-lg font-semibold text-gray-900">Rapor Al</h2>
          <div className="flex items-center gap-2">
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="daily">Günlük</option>
              <option value="weekly">Haftalık</option>
              <option value="monthly">Aylık</option>
            </select>
            <button
              onClick={generatePDF}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              <FileText size={20} />
              PDF İndir
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-4 font-medium text-gray-600">Tarih</th>
                <th className="p-4 font-medium text-gray-600">Miktar</th>
                <th className="p-4 font-medium text-gray-600">Notlar</th>
                <th className="p-4 font-medium text-gray-600">Kaydeden</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-gray-500">Yükleniyor...</td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-gray-500">Kayıt bulunamadı.</td>
                </tr>
              ) : (
                records.slice(0, 10).map((record, index) => (
                  <tr key={record.id || index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-4">{safeFormat(parseISO(record.date), 'dd.MM.yyyy')}</td>
                    <td className="p-4 font-medium">{record.quantity}</td>
                    <td className="p-4 text-gray-600">{record.notes || '-'}</td>
                    <td className="p-4 text-gray-600 text-sm">{record.updatedBy}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {records.length > 10 && (
            <p className="text-sm text-gray-500 mt-4 text-center">Son 10 kayıt gösterilmektedir. Tüm kayıtlar için rapor alabilirsiniz.</p>
          )}
        </div>
      </div>
    </div>
  );
}
