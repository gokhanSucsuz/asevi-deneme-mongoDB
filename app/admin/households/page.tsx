'use client';

import React, { useState } from 'react';
import { useAppQuery } from '@/lib/hooks';
import { db, Household, RouteStop, Route, SurveyResponse } from '@/lib/db';
import { Plus, Edit2, Trash2, X, Clock, FileText, Download, Eye, EyeOff, Upload, Home, Users, ShoppingBasket, Building2, ClipboardList, Star, Save, CheckCircle } from 'lucide-react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { format, subMonths, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthProvider';
import { getTurkishPdf, addVakifLogo, addReportFooter } from '@/lib/pdfUtils';
import autoTable from 'jspdf-autotable';
import { maskSensitive, isValidTcNo } from '@/lib/validation';
import * as XLSX from 'xlsx';
import { safeFormat } from '@/lib/date-utils';
import { normalizeTurkish } from '@/lib/utils';
import { addSystemLog } from '@/lib/logger';

export default function HouseholdsPage() {
  const { user, role, personnel } = useAuth();
  const isDemo = role === 'demo';
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<'search' | 'form'>('search');
  const [searchTcNo, setSearchTcNo] = useState('');
  const [searchHouseholdNo, setSearchHouseholdNo] = useState('');
  const [foundDeletedHousehold, setFoundDeletedHousehold] = useState<Household | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [householdToReport, setHouseholdToReport] = useState<Household | null>(null);
  const [reportRange, setReportRange] = useState('1');
  const [householdToDelete, setHouseholdToDelete] = useState<Household | null>(null);
  const [householdToViewHistory, setHouseholdToViewHistory] = useState<Household | null>(null);
  const [showSensitive, setShowSensitive] = useState<Record<string, boolean>>({});
  const [pauseDate, setPauseDate] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [sortField, setSortField] = useState<keyof Household>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [surveyModalOpen, setSurveyModalOpen] = useState(false);
  const [selectedHouseholdForSurvey, setSelectedHouseholdForSurvey] = useState<Household | null>(null);
  const [activeSurvey, setActiveSurvey] = useState<any>(null);
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, any>>({});
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const allHouseholds = useAppQuery(() => db.households.toArray(), [], 'households');
  const surveys = useAppQuery(() => db.surveys.toArray(), [], 'surveys');
  const surveyResponses = useAppQuery(() => db.surveyResponses.toArray(), [], 'survey_responses');
  const allDrivers = useAppQuery(() => db.drivers.toArray(), [], 'drivers');
  const activeRouteTemplates = useAppQuery(() => db.routeTemplates.toArray(), [], 'route_templates');
  const activeRouteTemplateStops = useAppQuery(() => db.routeTemplateStops.toArray(), [], 'route_template_stops');
  const [isLastWorkingDay, setIsLastWorkingDay] = useState(false);

  React.useEffect(() => {
    const checkLastDay = async () => {
      const { isLastWorkingDayOfWeek } = await import('@/lib/route-utils');
      const result = await isLastWorkingDayOfWeek(new Date());
      setIsLastWorkingDay(result);
    };
    checkLastDay();
  }, []);

  const personnelName = personnel?.name || 'Bilinmeyen Personel';

  // Summary Stats
  const stats = React.useMemo(() => {
    if (!allHouseholds) return { totalHouseholds: 0, totalPeople: 0, totalBread: 0, selfServiceHouseholds: 0, totalInstitutions: 0, householdPeople: 0, institutionPeople: 0, totalContainers: 0, wantsBreakfastTotal: 0, wantsBreakfastPeople: 0, noBreakfastTotal: 0, noBreakfastPeople: 0 };
    
    const todayStr = safeFormat(new Date(), 'yyyy-MM-dd');

    // "deneme" isimli kayıtları tüm hesaplamalardan çıkartıyoruz
    const activeHouseholds = allHouseholds.filter((h: Household) => {
      // Is it explicitly deleted?
      const isDeleted = h.pausedUntil === '9999-12-31';
      if (isDeleted) return false;

      // Filter out test records
      if (h.headName?.toLowerCase().includes('deneme')) return false;

      // Current logic: Must be isActive. 
      // But what if it was paused and the pause ended?
      // For stats calculation, if pausedUntil is in the past, it should be considered active
      const isPaused = h.pausedUntil && h.pausedUntil >= todayStr;
      
      return h.isActive || (h.pausedUntil && h.pausedUntil < todayStr);
    });

    const householdsOnly = activeHouseholds.filter((h: Household) => !h.type || h.type === 'household');
    const institutionsOnly = activeHouseholds.filter((h: Household) => h.type === 'institution');
    
    const inRouteHouseholds = householdsOnly.filter((h: Household) => !h.isSelfService);
    const selfServiceHouseholds = householdsOnly.filter((h: Household) => h.isSelfService);
    
    const totalPeople = activeHouseholds.reduce((sum: number, h: Household) => sum + (h.memberCount || 0), 0);
    
    const ownContainerCount = activeHouseholds.reduce((sum: number, h: Household) => {
      if (h.usesOwnContainer) {
        return sum + (h.memberCount || 0);
      }
      return sum;
    }, 0);

    const totalContainers = totalPeople - ownContainerCount;
    
    // Calculate total bread: Kahvaltı için ayrıca ekmek verilmiyor
    const totalBread = activeHouseholds.reduce((sum: number, h: Household) => sum + (h.breadCount || 0), 0);
    
    const wantsBreakfastTotal = activeHouseholds.filter(h => !h.noBreakfast).length;
    const noBreakfastTotal = activeHouseholds.filter(h => h.noBreakfast).length;
    
    const wantsBreakfastPeople = activeHouseholds.reduce((sum: number, h: Household) => {
      if (!h.noBreakfast) return sum + (h.memberCount || 0);
      return sum;
    }, 0);
    
    const noBreakfastPeople = activeHouseholds.reduce((sum: number, h: Household) => {
      if (h.noBreakfast) return sum + (h.memberCount || 0);
      return sum;
    }, 0);
    
    return {
      totalHouseholds: householdsOnly.length,
      totalInstitutions: institutionsOnly.length,
      totalPeople,
      householdPeople: householdsOnly.reduce((sum: number, h: Household) => sum + (h.memberCount || 0), 0),
      institutionPeople: institutionsOnly.reduce((sum: number, h: Household) => sum + (h.memberCount || 0), 0),
      totalBread,
      inRouteHouseholds: inRouteHouseholds.length,
      selfServiceHouseholds: selfServiceHouseholds.length,
      totalContainers,
      ownContainerCount,
      wantsBreakfastTotal,
      noBreakfastTotal,
      wantsBreakfastPeople,
      noBreakfastPeople
    };
  }, [allHouseholds]);

  const filteredHouseholds = allHouseholds?.filter((h: Household) => {
    // Liste tablosundan "deneme" isimli kayıtları gizliyoruz
    if (h.headName?.toLowerCase().includes('deneme')) return false;

    const search = normalizeTurkish(searchTerm);
    const matchesSearch = normalizeTurkish(h.headName).includes(search) || 
                          normalizeTurkish(h.address).includes(search) ||
                          h.phone.includes(searchTerm) ||
                          (h.tcNo && h.tcNo.includes(searchTerm)) ||
                          (h.householdNo && normalizeTurkish(h.householdNo).includes(search));
    
    if (statusFilter === 'active') return matchesSearch && h.isActive;
    if (statusFilter === 'passive') return matchesSearch && !h.isActive && h.pausedUntil !== '9999-12-31';
    if (statusFilter === 'deleted') return matchesSearch && h.pausedUntil === '9999-12-31';
    if (statusFilter === 'vakif_pickup') return matchesSearch && h.isSelfService;
    if (statusFilter === 'no_breakfast') return matchesSearch && h.noBreakfast;
    if (statusFilter === 'own_container') return matchesSearch && h.usesOwnContainer;
    if (statusFilter === 'type_institution') return matchesSearch && h.type === 'institution';
    if (statusFilter === 'type_household') return matchesSearch && (!h.type || h.type === 'household');
    
    return matchesSearch;
  });

  const sortedHouseholds = React.useMemo(() => {
    if (!filteredHouseholds) return [];
    return [...filteredHouseholds].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const normA = normalizeTurkish(aVal);
        const normB = normalizeTurkish(bVal);
        return sortOrder === 'asc' 
          ? normA.localeCompare(normB, 'tr') 
          : normB.localeCompare(normA, 'tr');
      }
      
      return sortOrder === 'asc' 
        ? (aVal > bVal ? 1 : -1) 
        : (bVal > aVal ? 1 : -1);
    });
  }, [filteredHouseholds, sortField, sortOrder]);

  const totalPages = Math.ceil((sortedHouseholds.length || 0) / itemsPerPage);
  const paginatedHouseholds = sortedHouseholds.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSort = (field: keyof Household) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const addLog = async (action: string, details?: string) => {
    await addSystemLog(user, personnel, action, details, 'household');
  };

  const { register, control, handleSubmit, reset, setValue, watch } = useForm<Household>({
    defaultValues: {
      type: 'household',
      headName: '',
      phone: '',
      address: '',
      members: [],
      memberCount: 1,
      breadCount: 1,
      isRetired: false,
      isActive: true,
    }
  });

  const householdType = watch('type');

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'members' as never
  });

  const openModal = (household?: Household) => {
    if (household) {
      setEditingId(household.id!);
      setModalStep('form');
      reset({
        ...household,
        breadCount: household.breadCount ?? household.memberCount,
        otherMemberCount: household.otherMemberCount ?? 0,
        isSelfService: household.isSelfService ?? false,
        isRetired: household.isRetired ?? false,
        usesOwnContainer: household.usesOwnContainer ?? false,
        members: household.members && household.members.length > 0 ? household.members : []
      });
      addLog('Hane Görüntülendi/Düzenleme Başlatıldı', `${household.headName} (${household.tcNo || household.householdNo}) hanesinin detaylarına bakıldı.`);
    } else {
      setEditingId(null);
      setModalStep('search');
      setSearchTcNo('');
      setSearchHouseholdNo('');
      setFoundDeletedHousehold(null);
      reset({
        tcNo: '',
        householdNo: '',
        headName: '',
        phone: '',
        address: '',
        members: [],
        memberCount: 1,
        otherMemberCount: 0,
        breadCount: 1,
        isRetired: false,
        isActive: true,
        isSelfService: false,
        usesOwnContainer: false,
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setModalStep('search');
    setFoundDeletedHousehold(null);
  };

  const handleSearch = () => {
    if (!searchTcNo && !searchHouseholdNo) {
      toast.error('Lütfen TC Kimlik No veya Hane No giriniz.');
      return;
    }

    const found = allHouseholds?.find((h: Household) => 
      (searchTcNo && h.tcNo === searchTcNo) || 
      (searchHouseholdNo && h.householdNo === searchHouseholdNo)
    );

    if (found) {
      addLog('Hane Sorgulandı (Kayıt Bulundu)', `${searchTcNo || searchHouseholdNo} bilgisi ile sorgulama yapıldı. ${found.headName} kaydı bulundu.`);
      if (found.pausedUntil === '9999-12-31') {
        setFoundDeletedHousehold(found);
      } else {
        toast.error('Bu hane zaten sistemde aktif veya pasif olarak kayıtlı.');
      }
    } else {
      addLog('Hane Sorgulandı (Kayıt Bulunmadı)', `${searchTcNo || searchHouseholdNo} bilgisi ile sorgulama yapıldı. Yeni kayıt oluşturulabilir.`);
      setModalStep('form');
      setValue('tcNo', searchTcNo);
      setValue('householdNo', searchHouseholdNo);
    }
  };

  const handleRestore = async () => {
    if (!foundDeletedHousehold) return;
    const loadingToast = toast.loading('Hane geri yükleniyor...');
    try {
      const history = foundDeletedHousehold.history || [];
      history.push({
        action: 'activated',
        timestamp: new Date(),
        note: 'Silinen hane tekrar aktifleştirildi'
      });
      await db.households.update(foundDeletedHousehold.id!, {
        isActive: true,
        pausedUntil: '',
        history
      });
      await addLog('Hane Geri Yüklendi', `${foundDeletedHousehold.headName} hanesi tekrar aktifleştirildi.`);
      toast.success('Hane başarıyla geri yüklendi', { id: loadingToast });
      closeModal();
    } catch (error) {
      console.error(error);
      toast.error('Geri yükleme sırasında bir hata oluştu', { id: loadingToast });
    }
  };

  const toggleSensitive = (id: string) => {
    setShowSensitive(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const onSubmit = async (data: Household) => {
    const loadingToast = toast.loading('Kaydediliyor...');
    try {
      if (data.tcNo && !isValidTcNo(data.tcNo)) {
        toast.error('Geçersiz TC Kimlik Numarası.', { id: loadingToast });
        return;
      }

      // Duplicate check
      const duplicate = allHouseholds?.find(h => 
        h.id !== editingId && (
          (data.tcNo && h.tcNo === data.tcNo) || 
          (data.householdNo && h.householdNo === data.householdNo)
        )
      );
      
      if (duplicate) {
        toast.error('Bu TC Kimlik No veya Hane No ile kayıtlı başka bir hane var.', { id: loadingToast });
        return;
      }

      const otherCount = parseInt(data.otherMemberCount as any) || 0;
      
      if (data.type === 'institution') {
        // For institutions, otherMemberCount is treated as the total count
        data.memberCount = otherCount;
        data.members = [];
      } else {
        // For households, memberCount = 1 (head) + named members + other members count
        const validMembers = data.members?.filter(m => m && m.trim() !== '') || [];
        data.members = validMembers;
        data.memberCount = 1 + validMembers.length + otherCount;
      }
      
      data.otherMemberCount = otherCount;
      
      if (data.breadCount === undefined || isNaN(data.breadCount)) {
        data.breadCount = data.memberCount;
      }

      if (editingId) {
        const existing = await db.households.get(editingId);
        const history = existing?.history || [];
        history.push({
          action: 'updated',
          timestamp: new Date(),
          note: `${data.type === 'institution' ? 'Kurum' : 'Hane'} bilgileri güncellendi`
        });
        await db.households.put({ ...data, id: editingId, history });
        await addLog('Kayıt Güncellendi', `${data.headName} ${data.type === 'institution' ? 'kurumunun' : 'hanesinin'} bilgileri güncellendi.`);
        toast.success('Başarıyla güncellendi', { id: loadingToast });
      } else {
        data.createdAt = new Date();
        data.history = [{
          action: 'created',
          timestamp: new Date(),
          note: `${data.type === 'institution' ? 'Kurum' : 'Hane'} sisteme eklendi`
        }];
        const newId = await db.households.add(data);
        data.id = newId as string;
        await addLog('Kayıt Eklendi', `${data.headName} ${data.type === 'institution' ? 'kurumu' : 'hanesi'} sisteme eklendi.`);
        toast.success('Başarıyla eklendi', { id: loadingToast });
      }

      // 1. Her durumda (eski/yeni fark etmeksizin) vakfın ve ilgili şoförün yarınki (veya haftanın kalan günleri) iş günü rota kaydına hane stopu eklenecek.
      const todayStr = safeFormat(new Date(), 'yyyy-MM-dd');
      const futureRoutes = await db.routes.toArray();
      const pendingOrInProgressRoutes = futureRoutes.filter(r => r.date >= todayStr && r.status !== 'completed' && r.status !== 'approved');

      // Helper for next working day
      const { getNextWorkingDay } = await import('@/lib/route-utils');
      
      const isNewRecord = !editingId;
      
      // We process future working days (if a route exists for them already).
      // Mostly affects the 'vakif_pickup' routes right away and next general routes if they were generated
      for (const route of pendingOrInProgressRoutes) {
         // Is this route suitable for the household?
         let isSuitable = false;
         if (data.isSelfService) {
             isSuitable = route.driverId === 'vakif_pickup';
         } else {
             // For standard route users, we don't automatically guess which driver. But if the route was already generated 
             // and we are updating the person's count who was ALREADY on this route, we need to update it
             // Or if it's a new record and they have a 'defaultDriverId', we add them
         }

         const stops = await db.routeStops.where('routeId').equals(route.id!).toArray();
         const existingStop = stops.find((s: RouteStop) => s.householdId === (editingId || data.id));

         // Conditions for being in a future route
         const isActivelyReceiving = data.isActive && data.pausedUntil !== '9999-12-31' && (!data.pausedUntil || data.pausedUntil < route.date);
         
         if (isActivelyReceiving) {
            if (data.isSelfService && route.driverId === 'vakif_pickup') {
                if (existingStop) {
                    await db.routeStops.update(existingStop.id!, {
                        householdSnapshotName: data.headName,
                         householdSnapshotMemberCount: data.memberCount,
                         householdSnapshotBreadCount: data.breadCount ?? data.memberCount
                    });
                } else {
                    await db.routeStops.add({
                         routeId: route.id!,
                         householdId: editingId || data.id!,
                         householdSnapshotName: data.headName,
                         householdSnapshotMemberCount: data.memberCount,
                         householdSnapshotBreadCount: data.breadCount ?? data.memberCount,
                         order: stops.length + 1,
                         status: 'pending'
                    });
                }
            } else if (!data.isSelfService && existingStop) {
                // Not self service, but WAS ALREADY on the route (so we just update amounts)
                await db.routeStops.update(existingStop.id!, {
                     householdSnapshotName: data.headName,
                     householdSnapshotMemberCount: data.memberCount,
                     householdSnapshotBreadCount: data.breadCount ?? data.memberCount
                 });
            } else if (!data.isSelfService && isNewRecord && typeof data.defaultDriverId === 'string' && route.driverId === data.defaultDriverId && route.date > todayStr) {
                // It's a new record with a designated driver, and the route is tomorrow or later
                 await db.routeStops.add({
                     routeId: route.id!,
                     householdId: data.id!,
                     householdSnapshotName: data.headName,
                     householdSnapshotMemberCount: data.memberCount,
                     householdSnapshotBreadCount: data.breadCount ?? data.memberCount,
                     order: stops.length + 1,
                     status: 'pending'
                });
            }
         } else {
             if (existingStop) {
                  await db.routeStops.delete(existingStop.id!);
             }
         }
      }

      // 2. Alert message for new household added
      if (isNewRecord && !data.isSelfService) {
        toast.info(`${data.headName} için kayıt oluşturuldu. Yarınki günlük rotaya otomatik atanması için 'Şoför Değişikliği/Atama' yapılmalıdır.`, { duration: 6000 });
      } else if (isNewRecord && data.isSelfService) {
        toast.info(`${data.headName} için kayıt oluşturuldu ve yarınki 'Vakıftan Alacaklar' rotasına eklendi.`, { duration: 6000 });
      }

      closeModal();
    } catch (error) {
      console.error(error);
      toast.error('Kayıt sırasında bir hata oluştu', { id: loadingToast });
    }
  };

  const handleViewHistory = (household: Household) => {
    setHouseholdToViewHistory(household);
    setHistoryModalOpen(true);
    addLog('Hane Geçmişi Görüntülendi', `${household.headName} hanesinin işlem geçmişine bakıldı.`);
  };

  const handleOpenReport = (household: Household) => {
    setHouseholdToReport(household);
    setReportModalOpen(true);
    addLog('Hane Raporu Hazırlanıyor', `${household.headName} hanesi için rapor ekranı açıldı.`);
  };

  const handleOpenSurvey = (household: Household) => {
    setSelectedHouseholdForSurvey(household);
    setSurveyModalOpen(true);
    setSurveyAnswers({});
    setActiveSurvey(null);
  };

  const handleSaveSurveyResponse = async () => {
    if (!activeSurvey || !selectedHouseholdForSurvey) return;

    const loadingToast = toast.loading('Cevaplar kaydediliyor...');
    try {
      const existingResponse = surveyResponses?.find((r: SurveyResponse) => r.surveyId === activeSurvey.id && r.householdId === selectedHouseholdForSurvey.id);

      const responseData = {
        surveyId: activeSurvey.id!,
        householdId: selectedHouseholdForSurvey.id!,
        answers: Object.entries(surveyAnswers).map(([qId, val]) => ({
          questionId: qId,
          value: val
        })),
        submittedAt: new Date(),
        submittedBy: user?.email || 'unknown'
      };

      if (existingResponse && existingResponse.id) {
        await db.surveyResponses.update(existingResponse.id, responseData);
      } else {
        await db.surveyResponses.add(responseData as SurveyResponse);
      }
      
      toast.success('Anket cevapları başarıyla kaydedildi', { id: loadingToast });
      setSurveyModalOpen(false);
      setSelectedHouseholdForSurvey(null);
      setActiveSurvey(null);
      setSurveyAnswers({});
    } catch (error) {
      console.error(error);
      toast.error('Kayıt sırasında hata oluştu', { id: loadingToast });
    }
  };

  const exportHouseholdReportPDF = async () => {
    if (!householdToReport) return;
    const loadingToast = toast.loading('Rapor hazırlanıyor...');
    
    try {
      const doc = await getTurkishPdf('portrait');
      const months = parseInt(reportRange);
      const endDate = new Date();
      const startDate = subMonths(endDate, months);

      // Fetch all route stops for this household
      const allStops = await db.routeStops.where('householdId').equals(householdToReport.id!).toArray();
      const allRoutes = await db.routes.toArray();
      
      const filteredStops = allStops.filter((stop: RouteStop) => {
        const route = allRoutes.find((r: Route) => r.id === stop.routeId);
        if (!route) return false;
        const routeDate = new Date(route.date);
        return isWithinInterval(routeDate, { start: startOfDay(startDate), end: endOfDay(endDate) });
      }).sort((a: RouteStop, b: RouteStop) => {
        const rA = allRoutes.find((r: Route) => r.id === a.routeId);
        const rB = allRoutes.find((r: Route) => r.id === b.routeId);
        return new Date(rB!.date).getTime() - new Date(rA!.date).getTime();
      });

      await addVakifLogo(doc, 14, 10, 20);

      doc.setFontSize(12);
      doc.setFont('Roboto', 'bold');
      doc.text('T.C.', doc.internal.pageSize.width / 2, 15, { align: 'center' });
      doc.text('SOSYAL YARDIMLAŞMA VE DAYANIŞMA VAKFI BAŞKANLIĞI', doc.internal.pageSize.width / 2, 22, { align: 'center' });
      
      doc.setFontSize(14);
      doc.text('HANE FAALİYET RAPORU', doc.internal.pageSize.width / 2, 35, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setFont('Roboto', 'normal');
      doc.text(`Rapor Tarihi: ${safeFormat(new Date(), 'dd.MM.yyyy HH:mm')}`, doc.internal.pageSize.width - 14, 15, { align: 'right' });
      
      doc.text(`Hane Sorumlusu: ${householdToReport.headName}`, 14, 45);
      doc.text(`Adres: ${householdToReport.address}`, 14, 50);
      doc.text(`Dönem: ${safeFormat(startDate, 'dd.MM.yyyy')} - ${safeFormat(endDate, 'dd.MM.yyyy')} (${months} Ay)`, 14, 55);

      const tableColumn = ["Tarih", "Şoför", "Durum", "Yemek/Ekmek", "Not/Hata"];
      const tableRows = filteredStops.map((stop: RouteStop) => {
        const route = allRoutes.find((r: Route) => r.id === stop.routeId);
        const breadCount = stop.householdSnapshotBreadCount ?? householdToReport.breadCount ?? householdToReport.memberCount;
        return [
          route ? safeFormat(new Date(route.date), 'dd.MM.yyyy') : '-',
          route?.driverSnapshotName || '-',
          stop.status === 'delivered' ? 'Teslim Edildi' : stop.status === 'failed' ? 'Teslim Edilemedi' : 'Bekliyor',
          `${householdToReport.memberCount} / ${breadCount}`,
          stop.issueReport || '-'
        ];
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 65,
        styles: { font: 'Roboto', fontSize: 9, lineColor: [0, 0, 0], lineWidth: 0.1 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        headStyles: { font: 'Roboto', fontStyle: 'bold', fillColor: [240, 240, 240], textColor: [0, 0, 0] }
      });

      addReportFooter(doc, personnelName);
      await addLog('Rapor İndirme', `${householdToReport.headName} hanesinin faaliyet raporu (PDF) indirildi.`);
      doc.save(`Hane_Raporu_${householdToReport.headName.replace(/\s+/g, '_')}.pdf`);
      toast.success('Rapor başarıyla oluşturuldu', { id: loadingToast });
      setReportModalOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('Rapor oluşturulurken bir hata oluştu', { id: loadingToast });
    }
  };

  const handleDeleteClick = (household: Household) => {
    setHouseholdToDelete(household);
    setPauseDate('');
    setActionReason('');
    setDeleteModalOpen(true);
  };

  const handleHardDelete = async () => {
    if (!actionReason.trim()) {
      toast.error('Lütfen silme sebebini giriniz.');
      return;
    }
    if (confirm('Bu haneyi tamamen silmek istediğinize emin misiniz? (Geçmiş istatistiklerde hane adı görünmeye devam edecektir)')) {
      const loadingToast = toast.loading('Siliniyor...');
      try {
        const existing = await db.households.get(householdToDelete!.id!);
        if (existing) {
          const history = existing.history || [];
          history.push({
            action: 'deleted',
            timestamp: new Date(),
            note: `Hane tamamen silindi. Sebep: ${actionReason}`
          });
          await db.households.update(existing.id!, {
            isActive: false,
            pausedUntil: '9999-12-31', // effectively deleted
            history
          });
          
          const today = new Date().toISOString().split('T')[0];
          // Remove from ALL future routes (including pending and in_progress)
          const futureRoutes = await db.routes.toArray();
          const activeRoutes = futureRoutes.filter(r => r.date >= today && r.status !== 'completed' && r.status !== 'approved');
          
          for (const r of activeRoutes) {
            await db.routeStops
              .where({ routeId: r.id, householdId: existing.id! })
              .delete();
          }

          await addLog('Hane Silindi', `${existing.headName} hanesi silindi. Tüm aktif ve gelecek rotalardan çıkarıldı. Sebep: ${actionReason}`);
          toast.success('Hane başarıyla silindi ve aktif/gelecek rotalardan kaldırıldı', { id: loadingToast });
        }
        setDeleteModalOpen(false);
      } catch (error) {
        console.error(error);
        toast.error('Silme işlemi sırasında bir hata oluştu', { id: loadingToast });
      }
    }
  };

  const handlePause = async () => {
    if (!pauseDate) {
      toast.error('Lütfen bir tarih seçin.');
      return;
    }
    if (!actionReason.trim()) {
      toast.error('Lütfen pasife alma sebebini giriniz.');
      return;
    }
    if (confirm(`Haneyi ${pauseDate} tarihine kadar pasife almak istediğinize emin misiniz?`)) {
      const loadingToast = toast.loading('Pasife alınıyor...');
      try {
        const existing = await db.households.get(householdToDelete!.id!);
        const history = existing?.history || [];
        history.push({
          action: 'paused',
          timestamp: new Date(),
          note: `${pauseDate} tarihine kadar pasife alındı. Sebep: ${actionReason}`
        });

        await db.households.update(householdToDelete!.id!, {
          isActive: false,
          pausedUntil: pauseDate,
          history
        });
        await addLog('Hane Pasife Alındı', `${householdToDelete!.headName} hanesi ${pauseDate} tarihine kadar pasife alındı. Sebep: ${actionReason}`);
        
        // Remove from pending routes within the pause period
        const today = new Date().toISOString().split('T')[0];
        const affectedRoutes = await db.routes
          .filter(r => r.status === 'pending' && r.date >= today && r.date <= pauseDate)
          .toArray();
        
        for (const r of affectedRoutes) {
          await db.routeStops
            .where({ routeId: r.id, householdId: householdToDelete!.id! })
            .delete();
        }

        toast.success('Hane başarıyla pasife alındı', { id: loadingToast });
        setDeleteModalOpen(false);
      } catch (error) {
        console.error(error);
        toast.error('Pasife alma işlemi sırasında bir hata oluştu', { id: loadingToast });
      }
    }
  };

  const downloadExcelTemplate = () => {
    const templateData = [
      {
        'Hane No': '',
        'TC Kimlik No': '',
        'Hane Sorumlusu': '',
        'Telefon': '',
        'Adres': '',
        'Kişi Sayısı': '',
        'Ekmek Sayısı': ''
      }
    ];
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sablon');
    XLSX.writeFile(workbook, 'Hane_Ekleme_Sablonu.xlsx');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const loadingToast = toast.loading('Excel dosyası işleniyor...');
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      let successCount = 0;
      let errorCount = 0;

      for (const row of jsonData as any[]) {
        try {
          const tcNo = row['tc kimlik no']?.toString() || row['TC Kimlik No']?.toString() || '';
          const householdNo = row['hane no']?.toString() || row['Hane No']?.toString() || '';
          const headName = row['hane sorumlusu']?.toString() || row['Hane Sorumlusu']?.toString() || '';
          const phone = row['telefon']?.toString() || row['Telefon']?.toString() || '';
          const address = row['adres']?.toString() || row['Adres']?.toString() || '';
          const memberCountStr = row['kişi sayısı']?.toString() || row['Kişi Sayısı']?.toString() || '1';
          const memberCount = parseInt(memberCountStr, 10) || 1;
          
          const breadCountStr = row['ekmek sayısı']?.toString() || row['Ekmek Sayısı']?.toString();
          const breadCount = breadCountStr !== undefined && breadCountStr !== '' ? parseInt(breadCountStr, 10) : memberCount;

          if (!headName || !address) {
            errorCount++;
            continue;
          }

          // Check duplicates
          const duplicate = allHouseholds?.find(h => 
            (tcNo && h.tcNo === tcNo) || 
            (householdNo && h.householdNo === householdNo)
          );

          if (duplicate) {
            errorCount++;
            continue;
          }

          const newHousehold: Household = {
            tcNo,
            householdNo,
            headName,
            phone,
            address,
            members: Array(Math.max(0, memberCount - 1)).fill(''),
            memberCount,
            breadCount: isNaN(breadCount) ? memberCount : breadCount,
            isActive: true,
            createdAt: new Date(),
            history: [{
              action: 'created',
              timestamp: new Date(),
              note: 'Excel ile toplu eklendi'
            }]
          };

          await db.households.add(newHousehold);
          successCount++;
        } catch (err) {
          errorCount++;
        }
      }

      if (successCount > 0) {
        await addLog('Toplu Hane Ekleme', `Excel dosyasından ${successCount} hane başarıyla eklendi.`);
        toast.success(`${successCount} hane başarıyla eklendi. ${errorCount > 0 ? `${errorCount} hane eklenemedi (eksik bilgi veya mükerrer).` : ''}`, { id: loadingToast });
      } else {
        toast.error('Hiçbir hane eklenemedi. Lütfen Excel formatını kontrol edin.', { id: loadingToast });
      }
    } catch (error) {
      console.error(error);
      toast.error('Dosya okunurken bir hata oluştu.', { id: loadingToast });
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const exportHouseholdsToExcel = async () => {
    if (!allHouseholds || !allDrivers || !activeRouteTemplates || !activeRouteTemplateStops) {
      toast.error('Veriler yükleniyor, lütfen bekleyin...');
      return;
    }

    const loadingToast = toast.loading('Excel dosyası hazırlanıyor...');
    try {
      const workbook = XLSX.utils.book_new();
      
      // Driver bazlı verileri gruplamak için bir map oluşturuyoruz
      // Map<DriverID, Household[]>
      const driverMap = new Map<string, Household[]>();
      
      // Serservis / Vakıf alanlarını ayrı tutuyoruz
      const vakifHouseholds: Household[] = [];
      const unassignedHouseholds: Household[] = [];
      
      // Silinmemiş ve aktif tüm haneleri al (dilersek tümünü de aktarabiliriz ama genelde aktif olanlar istenir, 
      // yedeğini almak gibi olacak dediği için silinenleri "Silinmiş Haneler" adında atabiliriz)
      const visibleHouseholds = allHouseholds.filter(h => h.pausedUntil !== '9999-12-31');
      const deletedHouseholds = allHouseholds.filter(h => h.pausedUntil === '9999-12-31');
      
      // Hane -> Template Map
      const householdToTemplateMap = new Map<string, string>();
      activeRouteTemplateStops.forEach(stop => {
         householdToTemplateMap.set(stop.householdId, stop.templateId);
      });
      
      // Template -> Driver Map
      const templateToDriverMap = new Map<string, string>();
      activeRouteTemplates.forEach(template => {
          templateToDriverMap.set(template.id!, template.driverId);
      });
      
      visibleHouseholds.forEach(h => {
        if (h.isSelfService) {
           vakifHouseholds.push(h);
        } else {
           const templateId = householdToTemplateMap.get(h.id!);
           const driverId = templateId ? templateToDriverMap.get(templateId) : null;
           
           if (driverId) {
              if (!driverMap.has(driverId)) driverMap.set(driverId, []);
              driverMap.get(driverId)!.push(h);
           } else {
              unassignedHouseholds.push(h);
           }
        }
      });
      
      // Fonksiyon: Household dizisini Excel Worksheet'e çevirir (gelişmiş stil ile)
      const createSheet = (dataList: Household[]) => {
         const rows = dataList.map((h, i) => ({
            'Sıra': i + 1,
            'TC Kimlik No': h.tcNo || '-',
            'Hane No': h.householdNo || '-',
            'Hane / Kurum Sorumlusu': h.headName,
            'Tip': h.type === 'institution' ? 'Kurum' : 'Hane',
            'Sorumlu Telefon': h.phone || '-',
            'Açık Adres': h.address || '-',
            'Toplam Kişi Sayısı': h.memberCount || 0,
            'Verilecek Ekmek': h.breadCount ?? h.memberCount ?? 0,
            'Özel Durum': [
               h.isRetired ? 'Emekli' : null,
               h.noBreakfast ? 'Kahvaltı İstemiyor' : null,
               h.usesOwnContainer ? 'Kendi Kabını Kullanıyor' : null,
            ].filter(Boolean).join(', ') || 'Yok',
            'Durum': h.isActive ? 'Aktif' : (h.pausedUntil ? `${safeFormat(new Date(h.pausedUntil), 'dd.MM.yyyy')} tarihine kadar pasif` : 'Pasif')
         }));
         
         const ws = XLSX.utils.json_to_sheet(rows);
         // Sütun genişliklerini ayarla (Görsellik ve Kullanıcı Dostu Mimarisi)
         ws['!cols'] = [
           { wch: 5 },  // Sıra
           { wch: 15 }, // TC
           { wch: 12 }, // Hane No
           { wch: 30 }, // İsim
           { wch: 10 }, // Tip
           { wch: 15 }, // Telefon
           { wch: 50 }, // Adres
           { wch: 18 }, // Kişi
           { wch: 15 }, // Ekmek
           { wch: 25 }, // Durum/Özel
           { wch: 20 }, // Aktif?
         ];
         return ws;
      };

      // 1. Şoförleri Sekme Sekme Ekle
      allDrivers.forEach(driver => {
         if (driver.isActive) {
             const hList = driverMap.get(driver.id!) || [];
             if (hList.length > 0) {
                const sheetName = driver.name.substring(0, 30); // Excel sheet name limit 31 chars
                XLSX.utils.book_append_sheet(workbook, createSheet(hList), sheetName);
             }
         }
      });
      
      // 2. Vakıftan Alanlar (Self Service)
      if (vakifHouseholds.length > 0) {
         XLSX.utils.book_append_sheet(workbook, createSheet(vakifHouseholds), 'Vakıftan Alanlar');
      }
      
      // 3. Atanmamış Haneler
      if (unassignedHouseholds.length > 0) {
         XLSX.utils.book_append_sheet(workbook, createSheet(unassignedHouseholds), 'Rotası Olmayanlar');
      }
      
      // 4. Silinmiş Haneler
      if (deletedHouseholds.length > 0) {
         XLSX.utils.book_append_sheet(workbook, createSheet(deletedHouseholds), 'Arşiv (Silinmiş)');
      }

      // Eğer sistem tamamen boşsa (Hiç hane yoksa)
      if (workbook.SheetNames.length === 0) {
         XLSX.utils.book_append_sheet(workbook, createSheet([]), 'Haneler');
      }

      XLSX.writeFile(workbook, `Haneler_Yedek_Raporu_${safeFormat(new Date(), 'dd_MM_yyyy')}.xlsx`);
      await addLog('Hane Dışa Aktarım', 'Tüm hane verileri (şoför ve gruplara ayrılmış olarak) Excel formatında dışa aktarıldı.');
      toast.success('Excel dosyası başarıyla indirildi', { id: loadingToast });
    } catch (error) {
      console.error(error);
      toast.error('Excel dosyası oluşturulurken bir hata meydana geldi', { id: loadingToast });
    }
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Haneler</h2>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <input
            type="file"
            accept=".xlsx, .xls"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <button
            onClick={exportHouseholdsToExcel}
            className="flex-1 md:flex-none bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 flex items-center justify-center text-sm"
          >
            <Download size={18} className="mr-2" />
            Yedek Al (Excel)
          </button>
          <button
            onClick={downloadExcelTemplate}
            className="flex-1 md:flex-none bg-gray-100 text-gray-700 border border-gray-300 px-4 py-2 rounded-md hover:bg-gray-200 flex items-center justify-center text-sm"
          >
            <Download size={18} className="mr-2" />
            Şablon
          </button>
          {!isDemo && (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 md:flex-none bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center justify-center text-sm"
              >
                <Upload size={18} className="mr-2" />
                Excel Yükle
              </button>
              <button
                onClick={() => openModal()}
                className="flex-1 md:flex-none bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center justify-center text-sm"
              >
                <Plus size={18} className="mr-2" />
                Yeni Hane
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 rounded-full bg-blue-50 text-blue-600">
            <Home size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Aktif Hane</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalHouseholds}</p>
            <p className="text-[10px] text-gray-400 mt-1">
              {stats.householdPeople} Kişi / {stats.inRouteHouseholds} Rota
            </p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 rounded-full bg-indigo-50 text-indigo-600">
            <Building2 size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Aktif Kurum</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalInstitutions}</p>
            <p className="text-[10px] text-gray-400 mt-1">
              {stats.institutionPeople} Kişi (Öğrenci vb.)
            </p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 rounded-full bg-green-50 text-green-600">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Toplam Yemek (Kişi)</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalPeople}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 rounded-full bg-orange-50 text-orange-600">
            <ShoppingBasket size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Günlük Ekmek</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalBread}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 rounded-full bg-yellow-50 text-yellow-600">
            <ShoppingBasket size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Kahvaltı Verilen</p>
            <p className="text-2xl font-bold text-gray-900">{stats.wantsBreakfastTotal}</p>
            <p className="text-[10px] text-gray-400 mt-1">
              {stats.wantsBreakfastPeople} Kişi
            </p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 rounded-full bg-gray-50 text-gray-600">
            <ShoppingBasket size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Kahvaltı İstemeyen</p>
            <p className="text-2xl font-bold text-gray-900">{stats.noBreakfastTotal}</p>
            <p className="text-[10px] text-gray-400 mt-1">
              {stats.noBreakfastPeople} Kişi
            </p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 rounded-full bg-teal-50 text-teal-600">
            <ShoppingBasket size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Kendi Kabını Kullanan</p>
            <p className="text-2xl font-bold text-gray-900">{stats.ownContainerCount}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 rounded-full bg-red-50 text-red-600">
            <ShoppingBasket size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Vakıf Kabı Kullanan</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalContainers}</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 w-full">
          <label className="block text-sm font-medium text-gray-700 mb-1">Ara</label>
          <input
            type="text"
            placeholder="İsim, adres veya telefon ile ara..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
          />
        </div>
        <div className="w-full md:w-48">
          <label className="block text-sm font-medium text-gray-700 mb-1">Durum Filtresi</label>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
          >
            <option value="all">Tüm Durumlar</option>
            <option value="active">Aktif</option>
            <option value="passive">Pasif</option>
            <option value="deleted">Silinmiş</option>
            <option value="vakif_pickup">Kendi İmkanlarıyla (Vakıftan)</option>
            <option value="no_breakfast">Kahvaltı İstemiyor</option>
            <option value="own_container">Kendi Kabını Kullanıyor</option>
            <option value="type_household">Yalnızca Haneler</option>
            <option value="type_institution">Yalnızca Kurumlar</option>
          </select>
        </div>
        <div className="w-full md:w-48">
          <label className="block text-sm font-medium text-gray-700 mb-1">Sayfa Başına</label>
          <select
            value={itemsPerPage}
            onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
          >
            <option value={20}>20 Kayıt</option>
            <option value={50}>50 Kayıt</option>
            <option value={100}>100 Kayıt</option>
            <option value={300}>300 Kayıt</option>
          </select>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-lg overflow-x-auto border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('createdAt')}
              >
                Sıra {sortField === 'createdAt' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('tcNo')}
              >
                TC Kimlik No {sortField === 'tcNo' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('headName')}
              >
                Hane / Kurum Adı {sortField === 'headName' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">Telefon</th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-40"
                onClick={() => handleSort('address')}
              >
                Adres {sortField === 'address' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('memberCount')}
              >
                Kişi Sayısı {sortField === 'memberCount' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('breadCount')}
              >
                Ekmek {sortField === 'breadCount' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">İşlemler</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedHouseholds?.map((household, index) => (
              <tr key={household.id}>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">
                  {(currentPage - 1) * itemsPerPage + index + 1}
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] tabular-nums">
                      {showSensitive[household.id!] ? household.tcNo : maskSensitive(household.tcNo)}
                    </span>
                    {household.tcNo && (
                      <button onClick={() => toggleSensitive(household.id!)} className="text-gray-400 hover:text-blue-600">
                        {showSensitive[household.id!] ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-3 py-4 whitespace-normal break-words text-sm font-medium text-gray-900">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-xs">{household.headName}</span>
                      {household.isRetired && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-purple-100 text-purple-700 uppercase tracking-tighter">
                          Emekli
                        </span>
                      )}
                    </div>
                    {household.type === 'institution' && (
                      <span className="text-[9px] text-indigo-600 font-bold uppercase">Kurum</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 w-32">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] tabular-nums">
                      {showSensitive[household.id!] ? household.phone : maskSensitive(household.phone, 3)}
                    </span>
                    {household.phone && (
                      <button onClick={() => toggleSensitive(household.id!)} className="text-gray-400 hover:text-blue-600">
                        {showSensitive[household.id!] ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-3 py-4 text-sm text-gray-500 w-32">
                  <div className="flex items-center gap-1 overflow-hidden">
                    <span className="text-[11px] truncate max-w-[100px]" title={household.address}>
                      {showSensitive[household.id!] ? household.address : maskSensitive(household.address, 10)}
                    </span>
                    {household.address && (
                      <button onClick={() => toggleSensitive(household.id!)} className="text-gray-400 hover:text-blue-600 flex-shrink-0">
                        {showSensitive[household.id!] ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-center text-gray-500">{household.memberCount}</td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-center text-gray-500">{household.breadCount ?? household.memberCount}</td>
                <td className="px-3 py-4 whitespace-normal break-words text-sm text-gray-500">
                  <div className="flex flex-col gap-0.5">
                    <span className={`px-1.5 py-0.5 inline-flex text-[9px] font-bold rounded-full uppercase ${household.isActive ? 'bg-green-100 text-green-800' : household.pausedUntil === '9999-12-31' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {household.isActive ? 'Aktif' : household.pausedUntil === '9999-12-31' ? 'SİLİNMİŞ' : 'Pasif'}
                    </span>
                    {household.isSelfService && (
                      <span className="px-1.5 py-0.5 inline-flex text-[8px] font-bold rounded-full bg-purple-100 text-purple-800 uppercase">
                        Vakıftan Alıyor
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end gap-1.5">
                    {!isDemo && (
                      <button onClick={() => handleOpenSurvey(household)} className="text-indigo-600 hover:text-indigo-900 p-1" title="Anket">
                        <ClipboardList size={14} />
                      </button>
                    )}
                    <button onClick={() => handleOpenReport(household)} className="text-green-600 hover:text-green-900 p-1" title="Rapor">
                      <FileText size={14} />
                    </button>
                    <button onClick={() => handleViewHistory(household)} className="text-gray-600 hover:text-gray-900 p-1" title="Geçmiş">
                      <Clock size={14} />
                    </button>
                    {!isDemo && (
                      <>
                        <button onClick={() => openModal(household)} className="text-blue-600 hover:text-blue-900 p-1" title="Düzenle">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDeleteClick(household)} className="text-red-600 hover:text-red-900 p-1" title="Sil">
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {paginatedHouseholds?.length === 0 && (
              <tr>
                <td colSpan={10} className="px-6 py-4 text-center text-sm text-gray-500">
                  Henüz hane eklenmemiş.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex justify-between items-center bg-white p-4 rounded-lg border border-gray-200">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 hover:bg-gray-50"
          >
            Önceki
          </button>
          <span className="text-sm text-gray-600">
            Sayfa {currentPage} / {totalPages} (Toplam {sortedHouseholds.length} kayıt)
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 hover:bg-gray-50"
          >
            Sonraki
          </button>
        </div>
      )}

      {historyModalOpen && householdToViewHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {householdToViewHistory.headName} - İşlem Geçmişi
              </h3>
              <button onClick={() => setHistoryModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto">
              {householdToViewHistory.history && householdToViewHistory.history.length > 0 ? (
                <div className="space-y-4">
                  {householdToViewHistory.history.sort((a, b) => new Date((b as any).timestamp || (b as any).date).getTime() - new Date((a as any).timestamp || (a as any).date).getTime()).map((item: any, idx) => (
                    <div key={idx} className="flex items-start border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                      <div className="mt-1 mr-4">
                        <Clock size={16} className="text-gray-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {item.action === 'created' ? 'Oluşturuldu' : 
                           item.action === 'updated' ? 'Güncellendi' : 
                           item.action === 'paused' ? 'Pasife Alındı' : 
                           item.action === 'activated' ? 'Aktifleştirildi' : 
                           item.action === 'deleted' ? 'Silindi' : 'İşlem Yapıldı'}
                        </p>
                        <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                          <Clock size={14} className="text-blue-500" />
                          {safeFormat(item.timestamp || item.date, 'dd.MM.yyyy HH:mm')}
                        </div>
                        {item.note && <p className="text-sm text-gray-700 mt-1">{item.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center">Bu hane için henüz işlem geçmişi bulunmuyor.</p>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end bg-gray-50">
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {reportModalOpen && householdToReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Hane Raporu - {householdToReport.headName}</h3>
              <button onClick={() => setReportModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rapor Dönemi</label>
                <select
                  value={reportRange}
                  onChange={(e) => setReportRange(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                >
                  <option value="1">Son 1 Ay</option>
                  <option value="3">Son 3 Ay</option>
                  <option value="6">Son 6 Ay</option>
                </select>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-md border border-blue-100">
                <p className="text-xs text-blue-700">
                  Bu rapor, seçilen dönem içindeki tüm yemek teslimatlarını, şoför bilgilerini ve varsa teslimat hatalarını içerecektir.
                </p>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setReportModalOpen(false)}
                  className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  İptal
                </button>
                <button
                  onClick={exportHouseholdReportPDF}
                  className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 flex items-center text-sm font-medium"
                >
                  <Download size={16} className="mr-2" />
                  PDF Oluştur
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {editingId ? 'Hane Düzenle' : (modalStep === 'search' ? 'Hane Sorgula' : 'Yeni Hane Ekle')}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-500">
                <X size={24} />
              </button>
            </div>
            
            {modalStep === 'search' ? (
              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-600 mb-4">
                  Yeni hane eklemeden önce, hanenin daha önce silinip silinmediğini kontrol etmek için TC Kimlik No veya Hane No ile sorgulama yapınız.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">TC Kimlik No</label>
                    <input
                      type="text"
                      value={searchTcNo}
                      onChange={(e) => setSearchTcNo(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                      placeholder="Örn: 12345678901"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Hane No</label>
                    <input
                      type="text"
                      value={searchHouseholdNo}
                      onChange={(e) => setSearchHouseholdNo(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                      placeholder="Örn: HN-123"
                    />
                  </div>
                </div>

                {foundDeletedHousehold && (
                  <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                    <h4 className="text-sm font-medium text-yellow-800 mb-2">Silinmiş Hane Bulundu!</h4>
                    <p className="text-sm text-yellow-700 mb-4">
                      <strong>{foundDeletedHousehold.headName}</strong> sorumluluğundaki hane daha önce silinmiş. Bu haneyi tekrar aktifleştirmek ister misiniz?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleRestore}
                        className="bg-yellow-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-yellow-700"
                      >
                        Evet, Tekrar Aktifleştir
                      </button>
                      <button
                        onClick={() => setFoundDeletedHousehold(null)}
                        className="bg-white text-gray-700 px-4 py-2 rounded-md text-sm font-medium border border-gray-300 hover:bg-gray-50"
                      >
                        İptal
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={closeModal}
                    className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleSearch}
                    className="bg-blue-600 border border-transparent rounded-md shadow-sm py-2 px-4 inline-flex justify-center text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Sorgula ve Devam Et
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
                <div className="flex gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      value="household"
                      {...register('type')}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700">Hane Kaydı</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      value="institution"
                      {...register('type')}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700">Kurum Kaydı</span>
                  </label>
                </div>

                {householdType === 'household' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">TC Kimlik No</label>
                      <input
                        type="text"
                        {...register('tcNo')}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                        placeholder="İsteğe bağlı"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Hane No</label>
                      <input
                        type="text"
                        {...register('householdNo')}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                        placeholder="İsteğe bağlı"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {householdType === 'institution' ? 'Kurum Adı / Sorumlu' : 'Hane Sorumlusu Adı Soyadı'}
                    </label>
                    <input
                      type="text"
                      {...register('headName', { required: true })}
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
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Ekmek Sayısı</label>
                    <input
                      type="number"
                      {...register('breadCount', { valueAsNumber: true, min: 0 })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                      placeholder="Boş bırakılırsa kişi sayısı kadar hesaplanır"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {householdType === 'institution' ? 'Kişi Sayısı (Öğrenci vb.)' : 'Diğer Hane Halkı Sayısı'}
                    </label>
                    <input
                      type="number"
                      {...register('otherMemberCount', { valueAsNumber: true, min: 0 })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                      placeholder={householdType === 'institution' ? 'Toplam kişi sayısı' : 'İsimsiz eklemek için'}
                    />
                    {householdType === 'household' && (
                      <p className="text-[10px] text-gray-400 mt-1">İsimlerini tek tek eklemediğiniz kişi sayısı</p>
                    )}
                  </div>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg border border-purple-100 space-y-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('isSelfService')}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm font-bold text-purple-900">
                      Vakıf&apos;tan Kendi İmkanları İle Yemek Alan {householdType === 'institution' ? 'Kurum' : 'Hane'}
                    </label>
                  </div>
                  <p className="text-xs text-purple-700">
                    Bu seçenek işaretlendiğinde {householdType === 'institution' ? 'kurum' : 'hane'} şoför rotalarına <strong>dahil edilmez</strong>. Vakıf&apos;tan kendi imkanlarıyla yemek alanlar olarak raporlanır ve yönetici tarafından toplu onaylanır.
                  </p>
                </div>
                
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 space-y-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('usesOwnContainer')}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm font-bold text-blue-900">
                      Kendi Yemek Kabını Kullanıyor
                    </label>
                  </div>
                  <p className="text-xs text-blue-700">
                    Bu seçenek işaretlendiğinde, kullanılan toplam kap sayısından bu {householdType === 'institution' ? 'kurum' : 'hane'} için olan miktar düşülür.
                  </p>
                </div>

                <div className="bg-orange-50 p-4 rounded-lg border border-orange-100 space-y-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('noBreakfast')}
                      id="noBreakfast"
                      className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                    />
                    <label htmlFor="noBreakfast" className="ml-2 block text-sm font-bold text-orange-900">
                      Kahvaltı Almıyor
                    </label>
                  </div>
                  <p className="text-xs text-orange-700">
                    Bu seçenek işaretlendiğinde, haftanın son iş günü dağıtılan ek öğün (kahvaltı) hesaplamasına bu hane dahil edilmez.
                  </p>
                  
                  <div className="pt-2 mt-2 border-t border-orange-200">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        {...register('isRetired')}
                        id="isRetired"
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                      />
                      <label htmlFor="isRetired" className="ml-2 block text-sm font-bold text-purple-900">
                        Emekli Hanesi
                      </label>
                    </div>
                    <p className="text-xs text-purple-700 mt-1">
                      Emekli olarak işaretlenen haneler, listede özel etiketle gösterilir.
                    </p>
                  </div>
                </div>

                {householdType === 'institution' && (
                  <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100 space-y-3">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        {...register('usesContainer')}
                        className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                      />
                      <label className="ml-2 block text-sm font-bold text-emerald-900">
                        Vakıf Kabı Kullanıyor
                      </label>
                    </div>
                    <p className="text-xs text-emerald-700">
                      Bu seçenek işaretlendiğinde, bu kurum için kişi sayısı kadar kap kullanıldığı varsayılır ve toplam kap sayısına eklenir.
                    </p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Adres</label>
                  <textarea
                    {...register('address', { required: true })}
                    rows={3}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                  />
                </div>
                
                {householdType === 'household' && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-gray-700">Hane Halkı (Kişiler)</label>
                      <button
                      type="button"
                      onClick={() => append('')}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      + Kişi Ekle
                    </button>
                  </div>
                  <div className="space-y-2">
                    {fields.map((field, index) => (
                      <div key={field.id} className="flex gap-2">
                        <input
                          type="text"
                          {...register(`members.${index}` as const)}
                          placeholder={`${index + 1}. Kişi Adı Soyadı (İsteğe bağlı)`}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                        />
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="text-red-600 hover:text-red-800 p-2"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center">
                <input
                  type="checkbox"
                  {...register('isActive')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-900">
                  Aktif (Yemek yardımı alıyor)
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
            )}
          </div>
        </div>
      )}
      {deleteModalOpen && householdToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Hane İşlemleri - {householdToDelete.headName}</h3>
              <button onClick={() => setDeleteModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <X size={24} />
              </button>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Haneyi tamamen silebilir veya belirli bir tarihe kadar pasife alabilirsiniz. Pasife alınan haneler rotalara eklenmez.
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">İşlem Sebebi (Zorunlu)</label>
              <textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Lütfen bu haneyi neden sildiğinizi veya pasife aldığınızı açıklayın..."
                className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                required
              />
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Geçici Olarak Pasife Al</h4>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={pauseDate}
                    onChange={(e) => setPauseDate(e.target.value)}
                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                  />
                  <button
                    onClick={handlePause}
                    className="bg-yellow-500 text-white px-4 py-2 rounded-md hover:bg-yellow-600 text-sm font-medium whitespace-nowrap"
                  >
                    Pasife Al
                  </button>
                </div>
              </div>

              <div className="bg-red-50 p-4 rounded-md border border-red-100">
                <h4 className="text-sm font-medium text-red-900 mb-2">Tamamen Sil</h4>
                <p className="text-xs text-red-700 mb-3">Bu işlem geri alınamaz. Hane aktif listelerden tamamen çıkarılır.</p>
                <button
                  onClick={handleHardDelete}
                  className="w-full bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 text-sm font-medium"
                >
                  Haneyi Sil
                </button>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
      {surveyModalOpen && selectedHouseholdForSurvey && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center p-8 border-b border-gray-100">
              <div>
                <h3 className="text-xl font-black text-gray-900">Anket Uygula</h3>
                <p className="text-sm text-gray-500">{selectedHouseholdForSurvey.headName} hanesi için anket girişi.</p>
              </div>
              <button onClick={() => setSurveyModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-8 flex-1 overflow-y-auto space-y-8">
              {!activeSurvey ? (
                <div className="space-y-4">
                  <label className="text-sm font-bold text-gray-700">Uygulanacak Anketi Seçin</label>
                  <div className="grid grid-cols-1 gap-3">
                    {surveys?.filter(s => s.isActive).map(survey => {
                      const isCompleted = surveyResponses?.some(r => r.surveyId === survey.id && r.householdId === selectedHouseholdForSurvey.id);
                      return (
                        <button
                          key={survey.id}
                          onClick={() => {
                            setActiveSurvey(survey);
                            if (isCompleted) {
                              const existingResponse = surveyResponses?.find(r => r.surveyId === survey.id && r.householdId === selectedHouseholdForSurvey.id);
                              if (existingResponse) {
                                const answersObj: Record<string, any> = {};
                                existingResponse.answers.forEach((a: any) => {
                                  answersObj[a.questionId] = a.value;
                                });
                                setSurveyAnswers(answersObj);
                              }
                            } else {
                              setSurveyAnswers({});
                            }
                          }}
                          className={`flex items-center justify-between p-4 rounded-2xl border transition-all text-left group ${isCompleted ? 'border-green-200 bg-green-50 hover:border-green-400' : 'border-gray-100 hover:border-indigo-600 hover:bg-indigo-50'}`}
                        >
                          <div>
                            <p className={`font-bold ${isCompleted ? 'text-green-800' : 'text-gray-900 group-hover:text-indigo-700'}`}>
                              {survey.title}
                            </p>
                            <p className={`text-xs ${isCompleted ? 'text-green-600' : 'text-gray-500'}`}>
                              {survey.questions.length} Soru {isCompleted && '• Tamamlandı'}
                            </p>
                          </div>
                          {isCompleted ? (
                            <CheckCircle size={20} className="text-green-500" />
                          ) : (
                            <Plus size={20} className="text-gray-300 group-hover:text-indigo-600" />
                          )}
                        </button>
                      );
                    })}
                    {surveys?.filter(s => s.isActive).length === 0 && (
                      <p className="text-center py-8 text-gray-500 italic">Şu an aktif bir anket bulunmamaktadır.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                    <h4 className="font-bold text-indigo-900 mb-1">{activeSurvey.title}</h4>
                    <p className="text-xs text-indigo-700">{activeSurvey.description}</p>
                  </div>

                  <div className="space-y-6">
                    {activeSurvey.questions.map((q: any, idx: number) => (
                      <div key={q.id} className="space-y-3">
                        <label className="block text-sm font-bold text-gray-900">
                          {idx + 1}. {q.text} {q.required && <span className="text-red-500">*</span>}
                        </label>
                        
                        {q.type === 'rating' && (
                          <div className="flex gap-4">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                onClick={() => setSurveyAnswers(prev => ({ ...prev, [q.id]: star }))}
                                className={`p-3 rounded-xl border transition-all ${surveyAnswers[q.id] === star ? 'bg-yellow-50 border-yellow-400 text-yellow-600' : 'bg-white border-gray-100 text-gray-300 hover:border-yellow-200'}`}
                              >
                                <Star size={24} fill={surveyAnswers[q.id] >= star ? 'currentColor' : 'none'} />
                              </button>
                            ))}
                          </div>
                        )}

                        {q.type === 'text' && (
                          <textarea
                            value={surveyAnswers[q.id] || ''}
                            onChange={(e) => setSurveyAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                            className="w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-3 text-sm"
                            placeholder="Cevabınızı yazın..."
                            rows={2}
                          />
                        )}

                        {(q.type === 'select' || q.type === 'radio') && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {q.options?.map((opt: string) => (
                              <button
                                key={opt}
                                onClick={() => setSurveyAnswers(prev => ({ ...prev, [q.id]: opt }))}
                                className={`p-3 rounded-xl border text-sm font-medium transition-all text-left ${surveyAnswers[q.id] === opt ? 'bg-indigo-50 border-indigo-400 text-indigo-700' : 'bg-white border-gray-100 text-gray-600 hover:border-indigo-200'}`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-8 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-3xl">
              <button
                onClick={() => {
                  if (activeSurvey) setActiveSurvey(null);
                  else setSurveyModalOpen(false);
                }}
                className="px-6 py-2.5 bg-white border border-gray-300 rounded-xl shadow-sm text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all"
              >
                {activeSurvey ? 'Geri' : 'Kapat'}
              </button>
              {activeSurvey && (
                <button
                  onClick={handleSaveSurveyResponse}
                  className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 text-sm font-bold transition-all flex items-center gap-2"
                >
                  <Save size={18} />
                  Cevapları Kaydet
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
