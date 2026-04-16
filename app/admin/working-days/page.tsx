'use client';

import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isBefore, startOfDay, addMonths, subMonths } from 'date-fns';
import { tr } from 'date-fns/locale';
import { db, WorkingDay } from '@/lib/db';
import { toast } from 'sonner';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Save, History, Info } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { safeFormat } from '@/lib/date-utils';

export default function WorkingDaysPage() {
  const { user, role } = useAuth();
  const isDemo = role === 'demo';
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [workingDays, setWorkingDays] = useState<WorkingDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const monthStr = safeFormat(currentMonth, 'yyyy-MM');
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  });

  useEffect(() => {
    const fetchWorkingDays = async () => {
      setIsLoading(true);
      try {
        const days = await db.working_days.where('month').equals(monthStr).toArray();
        setWorkingDays(days);
      } catch (error) {
        console.error(error);
        toast.error('Çalışma günleri yüklenirken bir hata oluştu');
      } finally {
        setIsLoading(false);
      }
    };
    fetchWorkingDays();
  }, [monthStr]);

  const toggleDay = (date: Date) => {
    const dateStr = safeFormat(date, 'yyyy-MM-dd');
    const today = startOfDay(new Date());
    
    if (isBefore(date, today)) {
      toast.error('Geçmiş tarihlerdeki çalışma günleri değiştirilemez.');
      return;
    }

    setWorkingDays(prev => {
      const existing = prev.find(d => d.date === dateStr);
      if (existing) {
        return prev.map(d => d.date === dateStr ? { ...d, isWorkingDay: !d.isWorkingDay } : d);
      } else {
        return [...prev, {
          date: dateStr,
          isWorkingDay: true, // Default to true if not exists and toggled
          month: monthStr,
          updatedAt: new Date(),
          updatedBy: user?.email || 'unknown'
        }];
      }
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Ensure all days in month have an entry if we want to be explicit, 
      // but usually we only save what's changed or all of them.
      // Let's save all days that were interacted with.
      
      const daysToSave = daysInMonth.map(day => {
        const dateStr = safeFormat(day, 'yyyy-MM-dd');
        const existing = workingDays.find(d => d.date === dateStr);
        if (existing) return existing;
        
        // Default: Weekdays are working days if not explicitly set
        const dayOfWeek = day.getDay();
        const isDefaultWorking = dayOfWeek !== 0 && dayOfWeek !== 6;
        
        return {
          date: dateStr,
          isWorkingDay: isDefaultWorking,
          month: monthStr,
          updatedAt: new Date(),
          updatedBy: user?.email || 'unknown'
        };
      });

      await db.working_days.bulkPut(daysToSave);
      
      // Log the action
      const session = localStorage.getItem('personnel-session');
      const sessionUser = session ? JSON.parse(session) : null;
      await db.system_logs.add({
        action: 'Çalışma Günleri Güncellendi',
        details: `${safeFormat(currentMonth, 'MMMM yyyy')} ayı çalışma günleri güncellendi.`,
        personnelName: sessionUser?.name || 'Sistem',
        personnelEmail: user?.email || 'Bilinmeyen Email',
        timestamp: new Date(),
        category: 'config'
      });

      toast.success('Çalışma günleri başarıyla kaydedildi');
    } catch (error) {
      console.error(error);
      toast.error('Kaydedilirken bir hata oluştu');
    } finally {
      setIsSaving(false);
    }
  };

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Yükleniyor...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Çalışma Günleri Yönetimi</h2>
          <p className="text-sm text-gray-500">Aylık çalışma takvimini buradan belirleyebilirsiniz.</p>
        </div>
        {!isDemo && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 flex items-center shadow-sm disabled:opacity-50"
          >
            <Save size={20} className="mr-2" />
            {isSaving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-4">
            <button onClick={prevMonth} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
              <ChevronLeft size={24} />
            </button>
            <h3 className="text-xl font-bold text-gray-900 capitalize">
              {safeFormat(currentMonth, 'MMMM yyyy')}
            </h3>
            <button onClick={nextMonth} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
              <ChevronRight size={24} />
            </button>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <CalendarIcon size={18} />
            <span>Takvim Görünümü</span>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-7 gap-2 mb-4">
            {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map(day => (
              <div key={day} className="text-center text-xs font-bold text-gray-400 uppercase py-2">
                {day}
              </div>
            ))}
            
            {/* Empty slots for start of month */}
            {Array.from({ length: (daysInMonth[0].getDay() + 6) % 7 }).map((_, i) => (
              <div key={`empty-${i}`} className="h-24" />
            ))}

            {daysInMonth.map(day => {
              const dateStr = safeFormat(day, 'yyyy-MM-dd');
              const wd = workingDays.find(d => d.date === dateStr);
              
              // Default logic if not in DB: Weekdays are working days
              const dayOfWeek = day.getDay();
              const isDefaultWorking = dayOfWeek !== 0 && dayOfWeek !== 6;
              const isWorking = wd ? wd.isWorkingDay : isDefaultWorking;
              
              const isPast = isBefore(day, startOfDay(new Date()));

              return (
                <div
                  key={dateStr}
                  onClick={() => toggleDay(day)}
                  className={`h-24 border rounded-lg p-2 cursor-pointer transition-all flex flex-col justify-between ${
                    isWorking 
                      ? 'border-blue-200 bg-blue-50 hover:bg-blue-100' 
                      : 'border-gray-100 bg-gray-50 hover:bg-gray-100'
                  } ${isPast ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                >
                  <div className="flex justify-between items-start">
                    <span className={`text-sm font-bold ${isWorking ? 'text-blue-700' : 'text-gray-400'}`}>
                      {safeFormat(day, 'd')}
                    </span>
                    {isWorking && <div className="w-2 h-2 bg-blue-500 rounded-full" />}
                  </div>
                  <div className="text-[10px] font-medium uppercase">
                    {isWorking ? (
                      <span className="text-blue-600">Çalışma Günü</span>
                    ) : (
                      <span className="text-gray-400">Tatil</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg flex gap-3">
            <Info className="text-amber-500 shrink-0" size={20} />
            <div className="text-sm text-amber-800">
              <p className="font-bold mb-1">Önemli Bilgilendirme:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Her ayın son çalışma günü, bir sonraki ayın takvimini belirlemeniz önerilir.</li>
                <li>Eğer takvim belirlenmezse, sistem otomatik olarak hafta içi günleri çalışma günü kabul eder.</li>
                <li>Geçmiş tarihlerdeki çalışma durumu değiştirilemez.</li>
                <li>Yapılan tüm değişiklikler sistem günlüğüne kaydedilir.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
