'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import { format } from 'date-fns';
import { Search, Filter, Clock, User, Tag, Info } from 'lucide-react';
import { useAppQuery } from '@/lib/hooks';

export default function SystemLogsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const allLogs = useAppQuery(() => db.system_logs.toArray(), [], 'system_logs');

  const filteredLogs = allLogs?.filter(log => {
    const matchesSearch = 
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.details || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.personnelName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.personnelEmail.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || log.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const totalPages = Math.ceil((filteredLogs?.length || 0) / itemsPerPage);
  const paginatedLogs = filteredLogs?.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const categories = Array.from(new Set(allLogs?.map(l => l.category) || []));

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">İşlem Geçmişi</h1>
        <div className="text-sm text-gray-500">
          Toplam {filteredLogs?.length || 0} işlem kaydı bulundu
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="İşlem, detay veya personel ara..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="w-full md:w-48 relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
          >
            <option value="all">Tüm Kategoriler</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="w-full md:w-48">
          <select
            value={itemsPerPage}
            onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value={20}>20 Kayıt</option>
            <option value={50}>50 Kayıt</option>
            <option value={100}>100 Kayıt</option>
            <option value={300}>300 Kayıt</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-4 font-medium text-gray-600">Tarih / Saat</th>
                <th className="p-4 font-medium text-gray-600">Personel</th>
                <th className="p-4 font-medium text-gray-600">Kategori</th>
                <th className="p-4 font-medium text-gray-600">İşlem</th>
                <th className="p-4 font-medium text-gray-600">Detaylar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedLogs?.map((log, idx) => (
                <tr key={log.id || idx} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock size={14} />
                      {format(new Date(log.timestamp), 'dd.MM.yyyy HH:mm:ss')}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900">{log.personnelName}</span>
                      <span className="text-xs text-gray-500">{log.personnelEmail}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                      {log.category}
                    </span>
                  </td>
                  <td className="p-4 font-medium text-gray-900">{log.action}</td>
                  <td className="p-4 text-sm text-gray-600 max-w-md">{log.details}</td>
                </tr>
              ))}
              {!paginatedLogs?.length && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 flex justify-between items-center">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50"
            >
              Önceki
            </button>
            <span className="text-sm text-gray-600">
              Sayfa {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50"
            >
              Sonraki
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
