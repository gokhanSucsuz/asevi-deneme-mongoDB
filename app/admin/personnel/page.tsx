'use client';

import { useState } from 'react';
import { useAppQuery } from '@/lib/hooks';
import { db, Personnel } from '@/lib/db';
import { Plus, Edit2, Trash2, X, Check, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { maskSensitive, isValidTcNo } from '@/lib/validation';
import { useAuth } from '@/components/AuthProvider';

export default function PersonnelPage() {
  const { user, role } = useAuth();
  const isDemo = role === 'demo';
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPersonnel, setEditingPersonnel] = useState<Personnel | null>(null);
  const [showSensitive, setShowSensitive] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState({
    tcNo: '',
    username: '',
    email: '',
    password: '',
    name: '',
    role: 'admin',
    isActive: true,
    isApproved: false
  });

  const personnelList = useAppQuery(() => db.personnel.toArray(), [], 'personnel');
  const session = typeof window !== 'undefined' ? localStorage.getItem('personnel-session') : null;
  const sessionUser = session ? JSON.parse(session) : null;
  const currentUserId = sessionUser ? sessionUser.id : null;

  const addLog = async (action: string, details?: string) => {
    if (!sessionUser) return;
    await db.system_logs.add({
      action,
      details: details || '',
      category: 'personnel',
      personnelEmail: user?.email || 'Bilinmeyen Email',
      personnelName: sessionUser.name || 'Bilinmeyen Personel',
      timestamp: new Date()
    });
  };

  const openModal = (personnel?: Personnel) => {
    if (personnel) {
      setEditingPersonnel(personnel);
      setFormData({
        tcNo: personnel.tcNo || '',
        username: personnel.username,
        email: personnel.email || '',
        password: '', // Don't show password
        name: personnel.name,
        role: personnel.role,
        isActive: personnel.isActive,
        isApproved: personnel.isApproved
      });
    } else {
      setEditingPersonnel(null);
      setFormData({
        tcNo: '',
        username: '',
        email: '',
        password: '',
        name: '',
        role: 'admin',
        isActive: true,
        isApproved: false
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPersonnel(null);
  };

  const toggleSensitive = (id: string) => {
    setShowSensitive(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const loadingToast = toast.loading('Kaydediliyor...');
    try {
      if (formData.tcNo && !isValidTcNo(formData.tcNo)) {
        toast.error('Geçersiz TC Kimlik Numarası.', { id: loadingToast });
        return;
      }

      // Check if username exists
      const existingUsername = await db.personnel.where('username').equals(formData.username).first();
      if (existingUsername && existingUsername.id !== editingPersonnel?.id) {
        toast.error('Bu kullanıcı adı zaten kullanılıyor.', { id: loadingToast });
        return;
      }

      // Check if tcNo exists
      const existingTcNo = personnelList?.find(p => p.tcNo === formData.tcNo && p.id !== editingPersonnel?.id);
      if (existingTcNo) {
        toast.error('Bu TC Kimlik No ile kayıtlı başka bir personel var.', { id: loadingToast });
        return;
      }

      // Check if email exists
      const existingEmail = personnelList?.find(p => p.email === formData.email && p.id !== editingPersonnel?.id);
      if (existingEmail) {
        toast.error('Bu e-posta adresi zaten kullanılıyor.', { id: loadingToast });
        return;
      }

      if (editingPersonnel) {
        const updateData: any = { ...formData };
        if (!formData.password) delete updateData.password; // Don't update password if empty
        
        await db.personnel.update(editingPersonnel.id!, updateData);
        await addLog('Personel Güncellendi', `${formData.name} personelinin bilgileri güncellendi.`);
        toast.success('Personel başarıyla güncellendi', { id: loadingToast });
      } else {
        // Check max personnel limit (2)
        if (personnelList && personnelList.length >= 2) {
          toast.error('Sistemde en fazla 2 yetkili personel kaydı olabilir.', { id: loadingToast });
          return;
        }

        if (!formData.password) {
          toast.error('Yeni personel için şifre zorunludur.', { id: loadingToast });
          return;
        }

        await db.personnel.add({
          ...formData,
          createdAt: new Date()
        });
        await addLog('Personel Eklendi', `${formData.name} personeli sisteme eklendi.`);
        toast.success('Personel başarıyla eklendi', { id: loadingToast });
      }
      closeModal();
    } catch (error) {
      console.error(error);
      toast.error('Kayıt sırasında bir hata oluştu', { id: loadingToast });
    }
  };

  const toggleStatus = async (personnel: Personnel) => {
    try {
      await db.personnel.update(personnel.id!, { isActive: !personnel.isActive });
      await addLog('Personel Durumu Değiştirildi', `${personnel.name} personeli ${!personnel.isActive ? 'aktifleştirildi' : 'pasife alındı'}.`);
      toast.success(`Personel ${!personnel.isActive ? 'aktifleştirildi' : 'pasife alındı'}`);
    } catch (error) {
      console.error(error);
      toast.error('İşlem sırasında bir hata oluştu');
    }
  };

  const toggleApproval = async (personnel: Personnel) => {
    try {
      const newApprovalStatus = !personnel.isApproved;
      await db.personnel.update(personnel.id!, { isApproved: newApprovalStatus });
      
      // If approved, notify the user via email
      if (newApprovalStatus) {
        try {
          await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'approval_notification',
              data: {
                name: personnel.name,
                email: personnel.email
              }
            })
          });
        } catch (emailError) {
          console.error('User notification email failed:', emailError);
        }
      }

      await addLog('Personel Onay Durumu Değiştirildi', `${personnel.name} personelinin onayı ${newApprovalStatus ? 'verildi' : 'kaldırıldı'}.`);
      toast.success(`Personel kaydı ${newApprovalStatus ? 'onaylandı' : 'onayı kaldırıldı'}`);
    } catch (error) {
      console.error(error);
      toast.error('İşlem sırasında bir hata oluştu');
    }
  };

  const deletePersonnel = async (id: string, username: string) => {
    if (id === currentUserId) {
      toast.error('Kendi hesabınızı silemezsiniz.');
      return;
    }
    if (confirm('Bu personeli silmek istediğinize emin misiniz?')) {
      try {
        const personnel = personnelList?.find(p => p.id === id);
        await db.personnel.delete(id);
        await addLog('Personel Silindi', `${personnel?.name || username} personeli sistemden silindi.`);
        toast.success('Personel başarıyla silindi');
      } catch (error) {
        console.error(error);
        toast.error('Silme işlemi sırasında bir hata oluştu');
      }
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Yetkili Personel</h1>
          <p className="text-sm text-gray-500 mt-1">Sistem üzerinde işlem yapmaya yetkili personelleri yönetin.</p>
        </div>
        {!isDemo && (
          <button
            onClick={() => openModal()}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center"
          >
            <Plus size={20} className="mr-2" />
            Yeni Personel
          </button>
        )}
      </div>

      <div className="bg-white shadow-sm rounded-lg overflow-x-auto border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TC Kimlik No</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kullanıcı Adı</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">E-posta</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ad Soyad</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Onay</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kayıt Tarihi</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">İşlemler</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {personnelList?.map((personnel) => (
              <tr key={personnel.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    {showSensitive[personnel.id!] ? personnel.tcNo : maskSensitive(personnel.tcNo)}
                    {personnel.tcNo && (
                      <button onClick={() => toggleSensitive(personnel.id!)} className="text-gray-400 hover:text-blue-600">
                        {showSensitive[personnel.id!] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {personnel.username}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {personnel.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {personnel.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {personnel.role === 'admin' ? 'Yönetici' : 'Personel'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    personnel.isApproved ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {personnel.isApproved ? 'Onaylı' : 'Bekliyor'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    personnel.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {personnel.isActive ? 'Aktif' : 'Pasif'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {format(new Date(personnel.createdAt), 'dd.MM.yyyy HH:mm')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {!isDemo && (
                    <>
                      <button onClick={() => toggleApproval(personnel)} className="text-blue-600 hover:text-blue-900 mr-3" title={personnel.isApproved ? "Onayı Kaldır" : "Onayla"}>
                        {personnel.isApproved ? <AlertTriangle size={18} /> : <Check size={18} />}
                      </button>
                      <button onClick={() => toggleStatus(personnel)} className="text-gray-600 hover:text-gray-900 mr-3" title={personnel.isActive ? "Pasife Al" : "Aktifleştir"}>
                        {personnel.isActive ? <X size={18} /> : <Check size={18} />}
                      </button>
                      <button onClick={() => openModal(personnel)} className="text-blue-600 hover:text-blue-900 mr-3" title="Düzenle">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => deletePersonnel(personnel.id!, personnel.username)} className="text-red-600 hover:text-red-900" title="Sil">
                        <Trash2 size={18} />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {editingPersonnel ? 'Personel Düzenle' : 'Yeni Personel Ekle'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-500">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">TC Kimlik No</label>
                  <input
                    type="text"
                    value={formData.tcNo}
                    onChange={(e) => setFormData({ ...formData, tcNo: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Kullanıcı Adı</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">E-posta</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Şifre {editingPersonnel && '(Değiştirmek için doldurun)'}</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                    required={!editingPersonnel}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Ad Soyad</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Rol</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                  >
                    <option value="admin">Yönetici</option>
                    <option value="user">Personel</option>
                  </select>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900">
                      Aktif
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.isApproved}
                      onChange={(e) => setFormData({ ...formData, isApproved: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900">
                      Onaylı
                    </label>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700"
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
