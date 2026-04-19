'use client';

import React, { useState, useMemo } from 'react';
import { useAppQuery } from '@/lib/hooks';
import { db, Survey, SurveyQuestion, SurveyResponse } from '@/lib/db';
import { Plus, Trash2, Edit2, Save, X, ClipboardList, BarChart3, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Users, PieChart as PieChartIcon } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/components/AuthProvider';
import { safeFormat } from '@/lib/date-utils';
import { addSystemLog } from '@/lib/logger';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { getTurkishPdf, addVakifLogo, addReportFooter } from '@/lib/pdfUtils';
import autoTable from 'jspdf-autotable';
import { toPng } from 'html-to-image';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function SurveysPage() {
  const { user, role, personnel } = useAuth();
  const isDemo = role === 'demo';
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'stats'>('list');
  const [selectedSurveyForStats, setSelectedSurveyForStats] = useState<string | null>(null);

  const surveys = useAppQuery(() => db.surveys.toArray(), [], 'surveys');
  const responses = useAppQuery(() => db.surveyResponses.toArray(), [], 'survey_responses');
  const households = useAppQuery(() => db.households.toArray(), [], 'households');

  const [newSurvey, setNewSurvey] = useState<Partial<Survey>>({
    title: '',
    description: '',
    questions: [],
    isActive: true
  });

  const addLog = async (action: string, details?: string) => {
    await addSystemLog(user, personnel, action, details, 'survey');
  };

  const handleAddQuestion = () => {
    const question: SurveyQuestion = {
      id: Math.random().toString(36).substr(2, 9),
      text: '',
      type: 'rating',
      required: true
    };
    setNewSurvey(prev => ({
      ...prev,
      questions: [...(prev.questions || []), question]
    }));
  };

  const handleRemoveQuestion = (id: string) => {
    setNewSurvey(prev => ({
      ...prev,
      questions: prev.questions?.filter(q => q.id !== id)
    }));
  };

  const handleQuestionChange = (id: string, field: keyof SurveyQuestion, value: any) => {
    setNewSurvey(prev => ({
      ...prev,
      questions: prev.questions?.map(q => q.id === id ? { ...q, [field]: value } : q)
    }));
  };

  const handleSaveSurvey = async () => {
    if (!newSurvey.title) {
      toast.error('Lütfen anket başlığı giriniz.');
      return;
    }
    if (!newSurvey.questions || newSurvey.questions.length === 0) {
      toast.error('Lütfen en az bir soru ekleyiniz.');
      return;
    }

    const loadingToast = toast.loading('Kaydediliyor...');
    try {
      if (editingSurvey) {
        await db.surveys.update(editingSurvey.id!, newSurvey);
        await addLog('Anket Güncellendi', `${newSurvey.title} anketi güncellendi.`);
        toast.success('Anket başarıyla güncellendi', { id: loadingToast });
      } else {
        await db.surveys.add({
          ...newSurvey as Survey,
          createdAt: new Date()
        });
        await addLog('Anket Oluşturuldu', `${newSurvey.title} anketi oluşturuldu.`);
        toast.success('Anket başarıyla oluşturuldu', { id: loadingToast });
      }
      setIsModalOpen(false);
      setEditingSurvey(null);
      setNewSurvey({ title: '', description: '', questions: [], isActive: true });
    } catch (error) {
      console.error(error);
      toast.error('Hata oluştu', { id: loadingToast });
    }
  };

  const handleDeleteSurvey = async (id: string, title: string) => {
    if (confirm('Bu anketi silmek istediğinize emin misiniz? Tüm cevaplar da silinecektir.')) {
      try {
        await db.surveys.delete(id);
        // Also delete responses
        const allResponses = await db.surveyResponses.toArray();
        const surveyResponses = allResponses.filter(r => r.surveyId === id);
        for (const resp of surveyResponses) {
          await db.surveyResponses.delete(resp.id!);
        }
        await addLog('Anket Silindi', `${title} anketi silindi.`);
        toast.success('Anket silindi');
      } catch (error) {
        console.error(error);
        toast.error('Silme işlemi başarısız');
      }
    }
  };

  const statsData = useMemo(() => {
    if (!selectedSurveyForStats || !responses || !surveys || !households) return null;
    const survey = surveys.find(s => s.id === selectedSurveyForStats);
    if (!survey) return null;

    const surveyResponses = responses.filter(r => r.surveyId === selectedSurveyForStats);
    
    // Weighted stats: multiply by household member count
    const getWeights = (r: SurveyResponse) => {
      const h = households.find(hh => hh.id === r.householdId);
      return h?.memberCount || 1;
    };

    const totalPeopleReached = surveyResponses.reduce((sum, r) => sum + getWeights(r), 0);

    const questionStats = survey.questions.map(q => {
      if (q.type === 'rating') {
        const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        let totalWeightedScore = 0;
        let totalWeightedResponses = 0;

        surveyResponses.forEach(r => {
          const val = r.answers.find(a => a.questionId === q.id)?.value;
          const weight = getWeights(r);
          if (val !== undefined && counts[val] !== undefined) {
            counts[val] += weight;
            totalWeightedScore += (val * weight);
            totalWeightedResponses += weight;
          }
        });

        return {
          id: q.id,
          text: q.text,
          type: q.type,
          data: Object.entries(counts).map(([name, value]) => ({ name: `${name} Yıldız`, value })),
          average: totalWeightedResponses > 0 ? (totalWeightedScore / totalWeightedResponses).toFixed(1) : 0,
          totalWeightedResponses
        };
      } else if (q.type === 'select' || q.type === 'radio') {
        const counts: Record<string, number> = {};
        q.options?.forEach(opt => counts[opt] = 0);
        
        surveyResponses.forEach(r => {
          const val = r.answers.find(a => a.questionId === q.id)?.value;
          const weight = getWeights(r);
          if (val !== undefined && counts[val] !== undefined) {
            counts[val] += weight;
          }
        });

        return {
          id: q.id,
          text: q.text,
          type: q.type,
          data: Object.entries(counts).map(([name, value]) => ({ name, value }))
        };
      } else {
        const answers = surveyResponses.map(r => ({
          value: r.answers.find(a => a.questionId === q.id)?.value,
          weight: getWeights(r)
        })).filter(v => v.value !== undefined);

        return {
          id: q.id,
          text: q.text,
          type: q.type,
          recentAnswers: answers.slice(-10).map(v => v.value)
        };
      }
    });

    return {
      survey,
      totalHouseholds: surveyResponses.length,
      totalPeopleReached,
      questionStats
    };
  }, [selectedSurveyForStats, responses, surveys, households]);

  const exportSurveyPDF = async () => {
    if (!statsData || !statsData.survey) return;
    const loadingToast = toast.loading('Anket PDF\'i hazırlanıyor (grafikler işleniyor)...');
    
    try {
      const doc = await getTurkishPdf('portrait');
      let finalY = await addVakifLogo(doc, 14, 10, 20);

      doc.setFontSize(12);
      doc.setFont('Roboto', 'bold');
      doc.text('T.C.', doc.internal.pageSize.width / 2, 15, { align: 'center' });
      doc.text('SOSYAL YARDIMLAŞMA VE DAYANIŞMA VAKFI BAŞKANLIĞI', doc.internal.pageSize.width / 2, 22, { align: 'center' });
      
      doc.setFontSize(14);
      doc.text('ANKET SONUÇ RAPORU', doc.internal.pageSize.width / 2, 35, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setFont('Roboto', 'normal');
      doc.text(`Rapor Tarihi: ${safeFormat(new Date(), 'dd.MM.yyyy HH:mm')}`, doc.internal.pageSize.width - 14, 15, { align: 'right' });

      doc.text(`Anket: ${statsData.survey.title}`, 14, 45);
      
      const participationRate = ((statsData.totalHouseholds / (households?.length || 1)) * 100).toFixed(1);
      const overallSatisfaction = statsData.questionStats.length > 0 
        ? (statsData.questionStats.filter(q => q.type === 'rating').reduce((sum, q) => sum + parseFloat(q.average as string), 0) / statsData.questionStats.filter(q => q.type === 'rating').length || 0).toFixed(1)
        : '0.0';

      // Summary Stats Section in PDF
      doc.setFontSize(11);
      doc.setFont('Roboto', 'bold');
      doc.setTextColor(79, 70, 229); // Indigo-600
      doc.text('GENEL ÖZET VE İSTATİSTİKLER', 14, 55);
      doc.line(14, 57, 196, 57);
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      
      // Card 1: Participation
      doc.setFont('Roboto', 'bold');
      doc.text('Toplam Hane Katılımı:', 14, 65);
      doc.setFont('Roboto', 'normal');
      doc.text(`${statsData.totalHouseholds}`, 65, 65);
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128); // Gray-500
      doc.text(`(Hane katılım oranı: %${participationRate})`, 80, 65);
      
      // Card 2: People Reached
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont('Roboto', 'bold');
      doc.text('Toplam Ulaşılan Kişi:', 14, 73);
      doc.setFont('Roboto', 'normal');
      doc.text(`${statsData.totalPeopleReached}`, 65, 73);
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      doc.text('Hane temsilcilerinin cevapları, hanelerindeki tüm bireyler baz alınarak ağırlıklandırılmıştır.', 14, 78);
      
      // Card 3: Satisfaction
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont('Roboto', 'bold');
      doc.text('Genel Verimlilik:', 14, 86);
      doc.setFont('Roboto', 'normal');
      doc.text(`${overallSatisfaction} / 5.0`, 65, 86);
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.text('Ortalama Memnuniyet', 85, 86);

      doc.setTextColor(0, 0, 0);
      finalY = 100;

      const chartElements = document.querySelectorAll('.survey-chart-container');
      for (let i = 0; i < chartElements.length; i++) {
        const el = chartElements[i] as HTMLElement;
        const qTitle = el.getAttribute('data-title');
        
        // Take a snapshot
        const canvasOriginalBg = el.style.backgroundColor;
        el.style.backgroundColor = 'white';
        const imgData = await toPng(el, { 
          quality: 0.95,
          backgroundColor: '#ffffff',
          pixelRatio: 2,
          filter: (node) => {
            if (node.tagName === 'svg' && (node as any).width?.baseVal?.value === 0) return false;
            return true;
          }
        });
        el.style.backgroundColor = canvasOriginalBg;
        
        if (finalY > 230) {
          doc.addPage();
          finalY = 20;
        }

        doc.setFont('Roboto', 'bold');
        doc.text(`${i + 1}. ${qTitle}`, 14, finalY);
        finalY += 5;
        
        // Calculate dynamic dimensions
        const imgProps = doc.getImageProperties(imgData);
        const pdfWidth = doc.internal.pageSize.getWidth() - 28; // 14 margin each side
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        doc.addImage(imgData, 'PNG', 14, finalY, pdfWidth, pdfHeight);
        finalY += pdfHeight + 15;
      }
      
      await addLog('Anket Raporu', `${statsData.survey.title} anketinin PDF raporu indirildi.`);
      const currentPersonnelName = personnel?.name || 'Bilinmeyen Personel';
      addReportFooter(doc, currentPersonnelName);
      doc.save(`Anket_Rapor_PDF_${safeFormat(new Date(), 'dd_MM_yyyy')}.pdf`);
      toast.success('Rapor başarıyla oluşturuldu', { id: loadingToast });
    } catch (e) {
      console.error(e);
      toast.error('Rapor oluşturulamadı.', { id: loadingToast });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
            <ClipboardList size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Anket Yönetimi</h2>
            <p className="text-sm text-gray-500">Hizmet memnuniyet anketlerini oluşturun ve analiz edin.</p>
          </div>
        </div>
        {!isDemo && (
          <div className="flex gap-2 w-full md:w-auto">
            <button
              onClick={() => {
                setActiveTab('list');
                setEditingSurvey(null);
                setNewSurvey({ title: '', description: '', questions: [], isActive: true });
                setIsModalOpen(true);
              }}
              className="flex-1 md:flex-none bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center justify-center shadow-sm transition-all"
            >
              <Plus size={20} className="mr-2" />
              Yeni Anket Oluştur
            </button>
          </div>
        )}
      </div>

      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('list')}
          className={`px-6 py-3 text-sm font-medium transition-colors relative ${activeTab === 'list' ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Anket Listesi
          {activeTab === 'list' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-6 py-3 text-sm font-medium transition-colors relative ${activeTab === 'stats' ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          İstatistikler ve Analiz
          {activeTab === 'stats' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
        </button>
      </div>

      {activeTab === 'list' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {surveys?.map(survey => {
            const surveyResponses = responses?.filter(r => r.surveyId === survey.id) || [];
            return (
              <div key={survey.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${survey.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {survey.isActive ? 'Aktif' : 'Pasif'}
                    </div>
                    {!isDemo && (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setEditingSurvey(survey);
                            setNewSurvey(survey);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteSurvey(survey.id!, survey.title)}
                          className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{survey.title}</h3>
                  <p className="text-sm text-gray-500 mb-6 line-clamp-2">{survey.description || 'Açıklama belirtilmemiş.'}</p>
                  
                  <div className="grid grid-cols-2 gap-4 py-4 border-t border-gray-50">
                    <div className="text-center">
                      <p className="text-xs text-gray-400 uppercase font-bold tracking-widest mb-1">Soru</p>
                      <p className="text-xl font-black text-gray-900">{survey.questions.length}</p>
                    </div>
                    <div className="text-center border-l border-gray-50">
                      <p className="text-xs text-gray-400 uppercase font-bold tracking-widest mb-1">Cevap</p>
                      <p className="text-xl font-black text-indigo-600">{surveyResponses.length}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-6 py-4 flex justify-between items-center">
                  <span className="text-[10px] text-gray-400 font-medium">
                    {safeFormat(new Date(survey.createdAt), 'dd.MM.yyyy')}
                  </span>
                  <button 
                    onClick={() => {
                      setSelectedSurveyForStats(survey.id!);
                      setActiveTab('stats');
                    }}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                  >
                    Detaylı Analiz <BarChart3 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
          {surveys?.length === 0 && (
            <div className="col-span-full py-20 text-center bg-white rounded-2xl border-2 border-dashed border-gray-200">
              <ClipboardList size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 font-medium">Henüz anket oluşturulmamış.</p>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="mt-4 text-indigo-600 font-bold hover:underline"
              >
                İlk anketi oluşturun
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <label className="block text-sm font-bold text-gray-700 mb-3">Analiz Edilecek Anketi Seçin</label>
            <select
              value={selectedSurveyForStats || ''}
              onChange={(e) => setSelectedSurveyForStats(e.target.value)}
              className="w-full md:w-96 rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-3"
            >
              <option value="">Anket Seçiniz...</option>
              {surveys?.map(s => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </div>

          {statsData ? (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-6 rounded-3xl text-white shadow-lg overflow-hidden relative">
                  <div className="relative z-10">
                    <p className="text-indigo-100 text-[10px] font-black uppercase tracking-widest mb-1">Toplam Hane Katılımı</p>
                    <p className="text-4xl font-black">{statsData.totalHouseholds}</p>
                    <div className="mt-4 flex items-center gap-2 text-indigo-200 text-xs font-bold">
                      <CheckCircle2 size={16} />
                      <span>Hane katılım oranı: %{((statsData.totalHouseholds / (households?.length || 1)) * 100).toFixed(1)}</span>
                    </div>
                  </div>
                  <ClipboardList className="absolute -bottom-4 -right-4 text-white/10 w-32 h-32 rotate-12" />
                </div>
                
                <div className="bg-white p-6 rounded-3xl text-gray-900 shadow-sm border border-gray-100 overflow-hidden relative">
                  <div className="relative z-10">
                    <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1">Toplam Ulaşılan Kişi</p>
                    <p className="text-4xl font-black text-indigo-600">{statsData.totalPeopleReached}</p>
                    <p className="text-xs text-gray-500 mt-4 leading-relaxed font-medium">
                      Hane temsilcilerinin cevapları, hanelerindeki tüm bireyler baz alınarak ağırlıklandırılmıştır.
                    </p>
                  </div>
                  <Users className="absolute -bottom-4 -right-4 text-indigo-50 w-32 h-32 rotate-12" />
                </div>

                <div className="bg-white p-6 rounded-3xl text-gray-900 shadow-sm border border-gray-100 flex flex-col justify-center">
                  <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-2">Genel Verimlilik</p>
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-black text-green-600">
                      {statsData.questionStats.length > 0 
                        ? (statsData.questionStats.filter(q => q.type === 'rating').reduce((sum, q) => sum + parseFloat(q.average as string), 0) / statsData.questionStats.filter(q => q.type === 'rating').length || 0).toFixed(1)
                        : '0.0'
                      }
                    </span>
                    <span className="text-sm font-bold text-gray-400 mb-1">/ 5.0</span>
                  </div>
                  <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase">Ortalama Memnuniyet</p>
                </div>
              </div>
              
              <div className="flex justify-end w-full mb-4">
                <button
                  onClick={exportSurveyPDF}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 flex items-center shadow-sm transition-all"
                >
                  <BarChart3 size={18} className="mr-2" />
                  PDF Rapor İndir
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {statsData.questionStats.map((q, idx) => (
                  <div key={q.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-6">
                      <h4 className="font-bold text-gray-900 pr-4">{idx + 1}. {q.text}</h4>
                      <div className="bg-gray-50 p-2 rounded-lg text-gray-400">
                        {q.type === 'rating' ? <BarChart3 size={20} /> : <PieChartIcon size={20} />}
                      </div>
                    </div>

                    {q.type === 'rating' && (
                      <div className="space-y-6 survey-chart-container" data-title={q.text}>
                        <div className="flex items-center gap-4">
                          <div className="text-4xl font-black text-indigo-600">{q.average}</div>
                          <div className="text-sm text-gray-500">
                            Ortalama Memnuniyet Puanı <br />
                            <span className="text-[10px] uppercase font-bold tracking-tighter">5 Üzerinden</span>
                          </div>
                        </div>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250}>
                            <BarChart data={q.data}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                              <Tooltip 
                                cursor={{ fill: '#f9fafb' }}
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                              />
                              <Bar dataKey="value" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {(q.type === 'select' || q.type === 'radio') && (
                      <div className="h-64 survey-chart-container" data-title={q.text}>
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250}>
                          <PieChart>
                            <Pie
                              data={q.data}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {q.data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            />
                            <Legend verticalAlign="bottom" height={36} iconType="circle" />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {q.type === 'text' && (
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Son Cevaplar</p>
                        {q.recentAnswers?.map((ans, i) => (
                          <div key={i} className="p-3 bg-gray-50 rounded-xl text-sm text-gray-700 border border-gray-100 italic">
                            &quot;{ans}&quot;
                          </div>
                        ))}
                        {(!q.recentAnswers || q.recentAnswers.length === 0) && (
                          <p className="text-sm text-gray-400 text-center py-4">Henüz cevap yok.</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-20 text-center bg-white rounded-2xl border-2 border-dashed border-gray-200">
              <BarChart3 size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 font-medium">Analiz için bir anket seçiniz.</p>
            </div>
          )}
        </div>
      )}

      {/* Survey Creation/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center p-8 border-b border-gray-100">
              <div>
                <h3 className="text-xl font-black text-gray-900">
                  {editingSurvey ? 'Anketi Düzenle' : 'Yeni Anket Oluştur'}
                </h3>
                <p className="text-sm text-gray-500">Soruları belirleyin ve anketi yayına alın.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-8 flex-1 overflow-y-auto space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Anket Başlığı</label>
                  <input
                    type="text"
                    value={newSurvey.title}
                    onChange={(e) => setNewSurvey(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-3"
                    placeholder="Örn: 2026 Ramazan Memnuniyet Anketi"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Durum</label>
                  <select
                    value={newSurvey.isActive ? 'true' : 'false'}
                    onChange={(e) => setNewSurvey(prev => ({ ...prev, isActive: e.target.value === 'true' }))}
                    className="w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-3"
                  >
                    <option value="true">Aktif (Cevap Toplanabilir)</option>
                    <option value="false">Pasif (Cevap Toplanamaz)</option>
                  </select>
                </div>
                <div className="col-span-full space-y-2">
                  <label className="text-sm font-bold text-gray-700">Açıklama</label>
                  <textarea
                    value={newSurvey.description}
                    onChange={(e) => setNewSurvey(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-3 h-24"
                    placeholder="Anketin amacını kısaca açıklayın..."
                  />
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h4 className="font-black text-gray-900 flex items-center gap-2">
                    <ClipboardList size={20} className="text-indigo-600" />
                    Anket Soruları
                  </h4>
                  <button
                    onClick={handleAddQuestion}
                    className="text-sm font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                  >
                    <Plus size={16} /> Soru Ekle
                  </button>
                </div>

                <div className="space-y-4">
                  {newSurvey.questions?.map((q, idx) => (
                    <div key={q.id} className="p-6 bg-gray-50 rounded-2xl border border-gray-100 relative group">
                      <button
                        onClick={() => handleRemoveQuestion(q.id)}
                        className="absolute top-4 right-4 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={18} />
                      </button>
                      
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        <div className="md:col-span-1 flex items-center justify-center">
                          <span className="text-2xl font-black text-gray-200">{idx + 1}</span>
                        </div>
                        <div className="md:col-span-7 space-y-2">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Soru Metni</label>
                          <input
                            type="text"
                            value={q.text}
                            onChange={(e) => handleQuestionChange(q.id, 'text', e.target.value)}
                            className="w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2.5 text-sm"
                            placeholder="Sorunuzu buraya yazın..."
                          />
                        </div>
                        <div className="md:col-span-4 space-y-2">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Soru Tipi</label>
                          <select
                            value={q.type}
                            onChange={(e) => handleQuestionChange(q.id, 'type', e.target.value)}
                            className="w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2.5 text-sm"
                          >
                            <option value="rating">Derecelendirme (1-5 Yıldız)</option>
                            <option value="text">Kısa Metin</option>
                            <option value="select">Çoktan Seçmeli (Dropdown)</option>
                            <option value="radio">Tekli Seçim (Radio)</option>
                          </select>
                        </div>
                      </div>

                      {(q.type === 'select' || q.type === 'radio') && (
                        <div className="mt-4 pl-12 space-y-2">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Seçenekler (Virgülle ayırın)</label>
                          <input
                            type="text"
                            value={q.options?.join(', ') || ''}
                            onChange={(e) => handleQuestionChange(q.id, 'options', e.target.value.split(',').map(s => s.trim()).filter(s => s !== ''))}
                            className="w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2.5 text-sm"
                            placeholder="Seçenek 1, Seçenek 2, Seçenek 3..."
                          />
                        </div>
                      )}
                    </div>
                  ))}
                  {(!newSurvey.questions || newSurvey.questions.length === 0) && (
                    <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                      <AlertCircle size={32} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-sm text-gray-400">Henüz soru eklenmedi.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-8 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-3xl">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2.5 bg-white border border-gray-300 rounded-xl shadow-sm text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all"
              >
                İptal
              </button>
              <button
                onClick={handleSaveSurvey}
                className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 text-sm font-bold transition-all flex items-center gap-2"
              >
                <Save size={18} />
                {editingSurvey ? 'Güncelle' : 'Anketi Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
