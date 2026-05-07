import { Household, Driver, Route, RouteStop, Personnel, SystemLog, BreadTracking } from './db';

const now = new Date();
const todayStr = now.toISOString().split('T')[0];

export const MOCK_HOUSEHOLDS: Household[] = [
  {
    id: 'mock-h1',
    headName: 'Ahmet Yılmaz (Demo)',
    phone: '555 000 1122',
    address: 'Atatürk Mah. 123. Sok. No: 5/1',
    memberCount: 3,
    members: ['Ahmet Yılmaz', 'Ayşe Yılmaz', 'Mehmet Yılmaz'],
    breadCount: 2,
    isActive: true,
    createdAt: new Date('2026-01-10'),
    type: 'household'
  },
  {
    id: 'mock-h2',
    headName: 'Fatma Demir (Demo)',
    phone: '555 000 3344',
    address: 'İstasyon Mah. Demir Cad. No: 12',
    memberCount: 5,
    members: ['Fatma Demir', 'Hasan Demir', 'Zeynep Demir', 'Ali Demir', 'Can Demir'],
    breadCount: 3,
    isActive: true,
    createdAt: new Date('2026-01-15'),
    type: 'household'
  },
  {
    id: 'mock-institution-1',
    headName: 'Edirne Huzurevi (Demo)',
    phone: '284 222 1122',
    address: 'Bülbüladası Mevkii',
    memberCount: 45,
    members: [],
    breadCount: 15,
    isActive: true,
    createdAt: new Date('2026-02-01'),
    type: 'institution'
  }
];

export const MOCK_DRIVERS: Driver[] = [
  {
    id: 'mock-d1',
    tcNo: '11122233344',
    name: 'Murat Şoför (Demo)',
    phone: '544 111 2233',
    vehiclePlate: '22 AB 123',
    isActive: true
  },
  {
    id: 'mock-d2',
    tcNo: '55566677788',
    name: 'Selin Sürücü (Demo)',
    phone: '544 333 4455',
    vehiclePlate: '22 BC 456',
    isActive: true
  }
];

export const MOCK_ROUTES: Route[] = [
  {
    id: 'mock-r1',
    driverId: 'mock-d1',
    driverSnapshotName: 'Murat Şoför (Demo)',
    date: todayStr,
    status: 'pending',
    createdAt: new Date()
  }
];

export const MOCK_ROUTE_STOPS: RouteStop[] = [
  {
    id: 'mock-s1',
    routeId: 'mock-r1',
    householdId: 'mock-h1',
    householdSnapshotName: 'Ahmet Yılmaz (Demo)',
    householdSnapshotMemberCount: 3,
    householdSnapshotBreadCount: 2,
    status: 'pending',
    order: 0
  },
  {
    id: 'mock-s2',
    routeId: 'mock-r1',
    householdId: 'mock-h2',
    householdSnapshotName: 'Fatma Demir (Demo)',
    householdSnapshotMemberCount: 5,
    householdSnapshotBreadCount: 3,
    status: 'pending',
    order: 1
  }
];

export const MOCK_PERSONNEL: Personnel[] = [
  {
    id: 'mock-p1',
    tcNo: '99999999999',
    username: 'demo_admin',
    email: 'demo@sydv.org.tr',
    name: 'Demo Yönetici',
    role: 'admin',
    isActive: true,
    isApproved: true,
    createdAt: new Date()
  }
];

export const MOCK_LOGS: SystemLog[] = [
  {
    id: 'mock-l1',
    action: 'Giriş Yapıldı',
    details: 'Demo kullanıcı sisteme giriş yaptı.',
    personnelName: 'Demo Yönetici',
    personnelEmail: 'demo@sydv.org.tr',
    timestamp: new Date(),
    category: 'auth'
  }
];

export const MOCK_BREAD: BreadTracking[] = [
  {
    id: 'mock-b1',
    date: todayStr,
    totalNeeded: 200,
    delivered: 0,
    leftoverAmount: 0,
    finalOrderAmount: 205,
    status: 'pending'
  }
];

export const MOCK_WORKING_DAYS: any[] = [
  {
    id: 'mock-wd1',
    date: todayStr,
    isWorkingDay: true,
    month: todayStr.substring(0, 7),
    updatedAt: new Date(),
    updatedBy: 'Demo Yönetici'
  }
];

export const MOCK_SURVEYS: any[] = [
  {
    id: 'mock-survey-1',
    title: 'Hizmet Memnuniyet Anketi (Demo)',
    description: 'Aşevi hizmetlerimizden memnuniyetinizi ölçmek için hazırlanmıştır.',
    isActive: true,
    createdAt: new Date(),
    questions: [
      { id: 'q1', text: 'Yemek kalitesinden memnun musunuz?', type: 'rating', required: true },
      { id: 'q2', text: 'Dağıtım saati uygun mu?', type: 'radio', options: ['Evet', 'Hayır'], required: true }
    ]
  }
];

export const MOCK_SURVEY_RESPONSES: any[] = [
  {
    id: 'mock-sr1',
    surveyId: 'mock-survey-1',
    householdId: 'mock-h1',
    answers: [
      { questionId: 'q1', value: 5 },
      { questionId: 'q2', value: 'Evet' }
    ],
    submittedAt: new Date(),
    submittedBy: 'Demo Yönetici'
  }
];
