'use client';

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/db';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { Search, Filter, Clock, User, Tag, Info, ArrowUpDown, ArrowUp, ArrowDown, Download } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useAppQuery } from '@/lib/hooks';
import { safeFormat } from '@/lib/date-utils';
import { normalizeTurkish } from '@/lib/utils';
import { decrypt, isEncrypted } from '@/lib/crypto';
import { getTurkishPdf, addVakifLogo, addReportFooter } from '@/lib/pdfUtils';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

export default function SystemLogsPage() {
  const { user, personnel } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [sortField, setSortField] = useState<string>('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const allLogs = useAppQuery(() => db.system_logs.toArray(), [], 'system_logs');
  
  const decryptedLogs = useMemo(() => {
    if (!allLogs) return [];
    return allLogs.map(log => {
      let details = log.details || '';
      if (isEncrypted(details)) {
        details = decrypt(details) || '*** Şifre Çözülemedi ***';
      }
      return {
        ...log,
        decryptedDetails: details
      };
    });
  }, [allLogs]);

  const filteredLogs = decryptedLogs?.filter(log => {
    const search = normalizeTurkish(searchTerm);
    const matchesSearch = 
      normalizeTurkish(log.action).includes(search) ||
      normalizeTurkish(log.decryptedDetails || '').includes(search) ||
      normalizeTurkish(log.personnelName).includes(search) ||
      normalizeTurkish(log.personnelEmail).includes(search);
    
    const matchesCategory = categoryFilter === 'all' || log.category === categoryFilter;
    
    let matchesDate = true;
    if (startDate && endDate && log.timestamp) {
      matchesDate = isWithinInterval(new Date(log.timestamp), {
        start: startOfDay(new Date(startDate)),
        end: endOfDay(new Date(endDate))
      });
    } else if (startDate && log.timestamp) {
      matchesDate = new Date(log.timestamp) >= startOfDay(new Date(startDate));
    } else if (endDate && log.timestamp) {
      matchesDate = new Date(log.timestamp) <= endOfDay(new Date(endDate));
    }

    return matchesSearch && matchesCategory && matchesDate;
  }).sort((a: any, b: any) => {
    let valA = (a as any)[sortField];
    let valB = (b as any)[sortField];

    if (sortField === 'timestamp') {
      valA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      valB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    } else if (sortField === 'decryptedDetails') {
      valA = a.decryptedDetails;
      valB = b.decryptedDetails;
    } else {
      valA = String(valA || '').toLowerCase();
      valB = String(valB || '').toLowerCase();
    }

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    
    // Fallback if timestamps are equal
    return (String(b.id || '')).localeCompare(String(a.id || ''));
  });

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc'); // Default to desc for dates and strings usually
    }
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) return <ArrowUpDown size={14} className="text-gray-400" />;
    return sortDirection === 'asc' ? <ArrowUp size={14} className="text-blue-500" /> : <ArrowDown size={14} className="text-blue-500" />;
  };

  const personnelName = personnel?.name || user?.email || 'Bilinmeyen Personel';

  const exportPDF = async () => {
    try {
      const doc = await getTurkishPdf('landscape');
      const finalY = await addVakifLogo(doc);
      
      doc.setFontSize(16);
      doc.setTextColor(30, 58, 138); // blue-900
      doc.text('SİSTEM İŞLEM GEÇMİŞİ RAPORU', 148.5, finalY + 10, { align: 'center' });
      
      const periodLabel = (startDate && endDate) ? 
        `${safeFormat(new Date(startDate), 'dd.MM.yyyy')} - ${safeFormat(new Date(endDate), 'dd.MM.yyyy')}` :
        (startDate ? `${safeFormat(new Date(startDate), 'dd.MM.yyyy')} ve sonrası` : 'Tüm Zamanlar');

      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Rapor Dönemi: ${periodLabel}`, 14, finalY + 20);
      doc.text(`Rapor Tarihi: ${safeFormat(new Date(), 'dd.MM.yyyy HH:mm')}`, 283, finalY + 20, { align: 'right' });
      doc.text(`Filtreler: Kategori(${categoryFilter})`, 14, finalY + 25);

      const tableData = filteredLogs?.map((log) => [
        safeFormat(log.timestamp, 'dd.MM.yyyy HH:mm:ss'),
        log.personnelName,
        log.category,
        log.action,
        log.decryptedDetails
      ]) || [];

      autoTable(doc, {
        startY: finalY + 30,
        head: [['Tarih / Saat', 'Personel', 'Kategori', 'İşlem', 'Detaylar']],
        body: tableData,
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 40 },
          2: { cellWidth: 30 },
          3: { cellWidth: 50 },
          4: { cellWidth: 'auto' } // takes remaining space
        },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        didParseCell: function (data) {
          if (data.cell.text && data.cell.text.length > 0) {
              const text = data.cell.text[0];
              const normalized = normalizeTurkish(text);
              data.cell.text[0] = normalized;
          }
        }
      });

      addReportFooter(doc, personnel?.name || 'Bilinmeyen Personel');
      
      doc.save(`sistem_gecmisi_${safeFormat(new Date(), 'yyyy-MM-dd_HH-mm')}.pdf`);
      toast.success('Rapor başarıyla oluşturuldu');
    } catch (e) {
      console.error(e);
      toast.error('Rapor oluşturulurken bir hata oluştu');
    }
  };

  const totalPages = Math.ceil((filteredLogs?.length || 0) / itemsPerPage);
  const paginatedLogs = filteredLogs?.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const categories = Array.from(new Set(allLogs?.map(l => l.category) || []));

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center bg-gradient-to-r from-slate-800 to-slate-900 p-6 rounded-2xl shadow-lg text-white">
        <div>
          <h1 className="text-3xl font-bold">İşlem Geçmişi</h1>
          <p className="text-slate-400 mt-2">Sistem üzerindeki tüm değişikliklerin denetim günlüğü.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={exportPDF}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-sm font-medium"
          >
            <Download size={18} />
            PDF Raporu
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="İşlem, detay veya personel ara..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors outline-none"
          />
        </div>
        <div className="w-full sm:w-48 relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
          >
            <option value="all">Tüm Kategoriler</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
            className="w-full sm:w-auto px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-gray-400">-</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
            className="w-full sm:w-auto px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div className="w-full sm:w-auto ml-auto">
          <select
            value={itemsPerPage}
            onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value={20}>20 Kayıt</option>
            <option value={50}>50 Kayıt</option>
            <option value={100}>100 Kayıt</option>
            <option value={300}>300 Kayıt</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <table className="w-full text-left table-fixed border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th onClick={() => handleSort('timestamp')} className="p-4 font-medium text-gray-600 cursor-pointer hover:bg-gray-100 select-none w-48">
                <div className="flex items-center justify-between">Tarih / Saat {getSortIcon('timestamp')}</div>
              </th>
              <th onClick={() => handleSort('personnelName')} className="p-4 font-medium text-gray-600 cursor-pointer hover:bg-gray-100 select-none w-48">
                <div className="flex items-center justify-between">Personel {getSortIcon('personnelName')}</div>
              </th>
              <th onClick={() => handleSort('category')} className="p-4 font-medium text-gray-600 cursor-pointer hover:bg-gray-100 select-none w-32">
                <div className="flex items-center justify-between">Kategori {getSortIcon('category')}</div>
              </th>
              <th onClick={() => handleSort('action')} className="p-4 font-medium text-gray-600 cursor-pointer hover:bg-gray-100 select-none w-56">
                <div className="flex items-center justify-between">İşlem {getSortIcon('action')}</div>
              </th>
              <th onClick={() => handleSort('decryptedDetails')} className="p-4 font-medium text-gray-600 cursor-pointer hover:bg-gray-100 select-none">
                <div className="flex items-center justify-between">Detaylar {getSortIcon('decryptedDetails')}</div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedLogs?.map((log, idx) => (
              <tr key={log.id || idx} className="hover:bg-blue-50/50 transition-colors">
                <td className="p-4 align-top break-words">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <Clock size={16} className="text-blue-500 shrink-0" />
                    {safeFormat(log.timestamp, 'dd.MM.yyyy HH:mm:ss')}
                  </div>
                </td>
                <td className="p-4 align-top break-words">
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-900">{log.personnelName}</span>
                    <span className="text-xs text-gray-500">{log.personnelEmail}</span>
                  </div>
                </td>
                <td className="p-4 align-top break-words">
                  <span className="px-2 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700">
                    {log.category}
                  </span>
                </td>
                <td className="p-4 font-medium text-gray-900 align-top break-words">{log.action}</td>
                <td className="p-4 text-sm text-gray-600 align-top break-words">{log.decryptedDetails}</td>
              </tr>
            ))}
            {!paginatedLogs?.length && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">
                  Arama kriterlerine uygun kayıt bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 flex justify-between items-center bg-gray-50 rounded-b-xl">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50 font-medium"
            >
              Önceki
            </button>
            <span className="text-sm font-medium text-gray-600">
              Sayfa <span className="text-gray-900">{currentPage}</span> / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50 font-medium"
            >
              Sonraki
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
