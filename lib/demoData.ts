import { Household, Route, RouteStop, LeftoverFood, BreadTracking, Personnel, Driver, SystemLog, Survey, SurveyResponse, RouteTemplate, RouteTemplateStop } from './db';

export const demoHouseholds: Household[] = [
  {
    id: 'demo-h-1',
    householdNo: '1001',
    tcNo: '12345678901',
    headName: 'Ahmet Yılmaz',
    phone: '05551234567',
    address: 'Cumhuriyet Mah. Atatürk Cad. No:1',
    memberCount: 4,
    members: [],
    usesOwnContainer: false,
    isActive: true,
    createdAt: new Date('2024-01-01T10:00:00Z'),
  },
  {
    id: 'demo-h-2',
    householdNo: '1002',
    tcNo: '98765432109',
    headName: 'Ayşe Demir',
    phone: '05329876543',
    address: 'İstiklal Mah. Fatih Sok. No:5',
    memberCount: 2,
    members: [],
    usesOwnContainer: true,
    isVakifPickup: true,
    isActive: true,
    createdAt: new Date('2024-01-02T11:00:00Z'),
  },
  {
    id: 'demo-h-3',
    householdNo: '1003',
    tcNo: '45612378901',
    headName: 'Mehmet Kaya',
    phone: '05054567890',
    address: 'Gültepe Mah. Lale Cad. No:12',
    memberCount: 5,
    members: [],
    usesOwnContainer: false,
    isActive: true,
    createdAt: new Date('2024-01-03T09:30:00Z'),
  }
];

export const demoPersonnel: Personnel[] = [
  {
    id: 'demo-p-1',
    tcNo: '11122233344',
    username: 'demo_admin',
    email: 'demo@sydv.org.tr',
    name: 'Demo Personel',
    role: 'admin',
    isActive: true,
    isApproved: true,
    createdAt: new Date('2024-01-01T08:00:00Z'),
  }
];

export const demoDrivers: Driver[] = [
  {
    id: 'demo-d-1',
    tcNo: '55566677788',
    name: 'Hasan Şoför',
    phone: '05445556677',
    vehiclePlate: '34 ABC 123',
    isActive: true,
  }
];

export const demoRoutes: Route[] = [
  {
    id: 'demo-r-1',
    date: new Date().toISOString().split('T')[0],
    driverId: 'demo-d-1',
    status: 'completed',
    startKm: 15000,
    endKm: 15050,
    createdAt: new Date(),
  }
];

export const demoRouteStops: RouteStop[] = [
  {
    id: 'demo-rs-1',
    routeId: 'demo-r-1',
    householdId: 'demo-h-1',
    householdSnapshotName: 'Ahmet Yılmaz',
    householdSnapshotMemberCount: 4,
    status: 'delivered',
    deliveredAt: new Date(),
    order: 1,
    mealType: 'standard',
    isManual: false
  },
  {
    id: 'demo-rs-3',
    routeId: 'demo-r-1',
    householdId: 'demo-h-3',
    householdSnapshotName: 'Mehmet Kaya',
    householdSnapshotMemberCount: 5,
    status: 'failed',
    order: 2,
    mealType: 'standard',
    isManual: false
  }
];

export const demoRouteTemplates: RouteTemplate[] = [
  {
    id: 'demo-rt-1',
    driverId: 'demo-d-1',
    createdAt: new Date(),
  }
];

export const demoRouteTemplateStops: RouteTemplateStop[] = [
  {
    id: 'demo-rts-1',
    templateId: 'demo-rt-1',
    householdId: 'demo-h-1',
    order: 1,
  },
  {
    id: 'demo-rts-2',
    templateId: 'demo-rt-1',
    householdId: 'demo-h-3',
    order: 2,
  }
];

export const demoLeftoverFood: LeftoverFood[] = [
  {
    id: 'demo-lf-1',
    date: new Date().toISOString().split('T')[0],
    quantity: 15,
    updatedAt: new Date(),
    updatedBy: 'demo-p-1',
  }
];

export const demoBreadTracking: BreadTracking[] = [
  {
    id: 'demo-bt-1',
    date: new Date().toISOString().split('T')[0],
    totalNeeded: 100,
    delivered: 90,
    leftoverAmount: 5,
    finalOrderAmount: 95,
    status: 'ordered',
  }
];

export const demoSystemLogs: SystemLog[] = [
  {
    id: 'demo-sl-1',
    action: 'create',
    personnelName: 'Demo Personel',
    personnelEmail: 'demo@sydv.org.tr',
    details: 'Yeni hane eklendi: Ahmet Yılmaz',
    timestamp: new Date(),
    category: 'households',
  }
];

export const demoSurveys: Survey[] = [];
export const demoSurveyResponses: SurveyResponse[] = [];

// Helper to mask data
export const maskName = (name: string | undefined) => {
  if (!name) return '';
  const parts = name.split(' ');
  return parts.map(part => {
    if (part.length <= 2) return part;
    return part.substring(0, 2) + '*'.repeat(part.length - 2);
  }).join(' ');
};

export const maskTcNo = (tcNo: string | undefined) => {
  if (!tcNo || tcNo.length !== 11) return tcNo || '';
  return tcNo.substring(0, 3) + '******' + tcNo.substring(9);
};

// Mask the demo data before exporting
export const getMaskedDemoHouseholds = () => demoHouseholds.map(h => ({
  ...h,
  headName: maskName(h.headName),
  tcNo: maskTcNo(h.tcNo),
}));

export const getMaskedDemoRouteStops = () => demoRouteStops.map(rs => ({
  ...rs,
  householdSnapshotName: maskName(rs.householdSnapshotName),
}));
