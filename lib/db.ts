import { auth } from '../firebase';
import { notifyDbChange } from './hooks';
import { revalidateData } from './cache-actions';
import * as MOCK from './mock-data';

// Helper to check demo mode
const isDemoMode = () => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('isDemoUser') === 'true' || auth.currentUser?.email === 'demo@sydv.org.tr';
};

const checkDemoMode = () => {
  if (isDemoMode()) {
    throw new Error('Demo sürümünde veri değişikliği yapılamaz');
  }
};

// Types
export interface HouseholdHistory {
  action: 'created' | 'updated' | 'paused' | 'activated' | 'deleted' | 'route_changed';
  timestamp: Date;
  note?: string;
  personnelName?: string;
}

export interface Household {
  id?: string;
  type?: 'household' | 'institution';
  tcNo?: string;
  householdNo?: string;
  headName: string;
  phone: string;
  address: string;
  noBreakfast?: boolean;
  members: string[];
  memberCount: number;
  otherMemberCount?: number;
  breadCount?: number;
  isActive: boolean;
  isSelfService?: boolean;
  isVakifPickup?: boolean;
  usesOwnContainer?: boolean;
  usesContainer?: boolean;
  isRetired?: boolean;
  pausedUntil?: string;
  createdAt: Date;
  defaultDriverId?: string;
  history?: HouseholdHistory[];
}

export interface Driver {
  id?: string;
  tcNo: string;
  name: string;
  phone: string;
  googleEmail?: string;
  vehiclePlate: string;
  isActive: boolean;
}

export interface RouteHistory {
  action: string;
  timestamp: Date;
  note?: string;
  personnelName?: string;
}

export interface Route {
  id?: string;
  driverId: string;
  driverSnapshotName?: string;
  date: string;
  status: 'pending' | 'in_progress' | 'completed' | 'approved';
  isPaused?: boolean;
  startKm?: number;
  endKm?: number;
  remainingFood?: number;
  remainingBread?: number;
  completedByPersonnel?: boolean;
  personnelCompletionTime?: Date;
  createdAt: Date;
  history?: RouteHistory[];
}

export interface RouteStopHistory {
  status: 'pending' | 'delivered' | 'failed';
  timestamp: Date;
  note?: string;
  personnelName?: string;
}

export interface RouteStop {
  id?: string;
  routeId: string;
  householdId: string;
  householdSnapshotName?: string;
  householdSnapshotMemberCount?: number;
  householdSnapshotBreadCount?: number;
  status: 'pending' | 'delivered' | 'failed';
  issueReport?: string;
  deliveredAt?: Date;
  history?: RouteStopHistory[];
  order: number;
  mealType?: 'standard' | 'breakfast';
  isManual?: boolean;
}

export interface RouteTemplate {
  id?: string;
  driverId: string;
  createdAt: Date;
}

export interface RouteTemplateStop {
  id?: string;
  templateId: string;
  householdId: string;
  order: number;
}

export interface Personnel {
  id?: string;
  tcNo: string;
  username: string;
  email: string;
  password?: string;
  name: string;
  role: string;
  isActive: boolean;
  isApproved: boolean;
  createdAt: Date;
}

export interface SystemLog {
  id?: string;
  action: string;
  details?: string;
  personnelName: string;
  personnelEmail: string;
  timestamp: Date;
  category: string;
}

export interface WorkingDay {
  id?: string;
  date: string; // yyyy-MM-dd
  isWorkingDay: boolean;
  month: string; // yyyy-MM
  updatedAt: Date;
  updatedBy: string;
}

export interface BreadTracking {
  id?: string;
  date: string; // yyyy-MM-dd
  totalNeeded: number;
  delivered: number;
  leftoverAmount: number;
  finalOrderAmount: number;
  containerCount?: number;
  ownContainerCount?: number;
  deliveryDate?: string; // yyyy-MM-dd
  status: 'pending' | 'ordered';
  note?: string;
  manualLeftoverAmount?: number;
  manualLeftoverNote?: string;
}

export interface LeftoverFood {
  id?: string;
  date: string; // yyyy-MM-dd
  quantity: number;
  notes?: string;
  updatedAt: Date;
  updatedBy: string;
}

export interface Tender {
  id?: string;
  name: string;
  date: string; // yyyy-MM-dd
  tenderNo?: string;
  endDate: string; // yyyy-MM-dd
  maxBreadCount: number;
  remainingMaxBreadCount: number;
  createdAt: Date;
}

export interface SurveyQuestion {
  id: string;
  text: string;
  type: 'text' | 'select' | 'radio' | 'rating';
  options?: string[]; // For select and radio
  required: boolean;
}

export interface Survey {
  id?: string;
  title: string;
  description: string;
  questions: SurveyQuestion[];
  isActive: boolean;
  createdAt: Date;
}

export interface SurveyResponse {
  id?: string;
  surveyId: string;
  householdId: string;
  answers: {
    questionId: string;
    value: any;
  }[];
  submittedAt: Date;
  submittedBy: string; // Personnel name or email
}

export interface SystemSettings {
  id: string;
  lastBackupDate?: Date;
  backupIntervalDays: number;
  isDistributionPanelActive: boolean;
}

// Helper to convert date strings back to Dates and decrypt sensitive fields
const processData = (data: any): any => {
  if (!data || typeof data !== 'object') return data;
  
  // If it's a Date or other non-plain object, don't process further
  if (data instanceof Date) return data;
  
  // Handle MongoDB EJSON $date format
  if (data.$date) {
    if (typeof data.$date === 'string' || typeof data.$date === 'number') {
      const d = new Date(data.$date);
      if (!isNaN(d.getTime())) return d;
    } else if (typeof data.$date === 'object' && data.$date.$numberLong) {
      // Handle {$date: {$numberLong: "..."}}
      const d = new Date(parseInt(data.$date.$numberLong));
      if (!isNaN(d.getTime())) return d;
    }
    return data;
  }
  
  // Handle MongoDB EJSON $oid format
  if (data.$oid && typeof data.$oid === 'string') {
    return data.$oid;
  }
  
  // Convert _id to id for consistent application usage
  if (data._id && !data.id) {
    const rawId = typeof data._id === 'object' && data._id.$oid ? data._id.$oid : data._id;
    data.id = String(rawId);
  }
  
  // More robust id handling - if we have an id that is an object ($oid), convert it
  if (data.id && typeof data.id === 'object' && data.id.$oid) {
    data.id = String(data.id.$oid);
  }
  
  const result = Array.isArray(data) ? [...data] : { ...data };
  
  const dateFields = [
    'createdAt', 'updatedAt', 'timestamp', 'submittedAt', 
    'lastBackupDate', 'deliveredAt', 'personnelCompletionTime'
  ];

  const stringDateFields = ['date', 'endDate', 'pausedUntil', 'month'];

  for (const key in result) {
    let value = result[key];
    
    // First, process nested objects (including EJSON dates)
    if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
      value = processData(value);
      result[key] = value;
    }

    // 1. Force conversion to Date for known Date fields or any key ending in 'At'
    if (key.endsWith('At') || dateFields.includes(key)) {
      if ((typeof value === 'string' && value.length > 5) || typeof value === 'number') {
        const d = new Date(value);
        if (!isNaN(d.getTime())) {
          result[key] = d;
        }
      }
    } 
    // 2. Specialized handling for yyyy-MM-dd fields
    else if (stringDateFields.includes(key)) {
      if (value instanceof Date) {
        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, '0');
        const day = String(value.getDate()).padStart(2, '0');
        result[key] = `${year}-${month}-${day}`;
      } else if (typeof value === 'string' && value.includes('T')) {
        result[key] = value.split('T')[0];
      }
    }
  }
  return result;
};

let normalizationStarted = false;
export const normalizeDatabaseTypes = async () => {
  try {
    if (normalizationStarted) return;
    if (!auth.currentUser) return;
    normalizationStarted = true;

    const drivers = await db.drivers.toArray();
    const routes = await db.routes.toArray();
    const logs = await db.system_logs.toArray();

    // 1. Log Sorting Normalization
    for (const l of logs) {
      if (!l.timestamp || isNaN(new Date(l.timestamp).getTime())) {
        await db.system_logs.update(l.id!, { timestamp: new Date() });
      }
    }

    // 2. Driver ID Synchronization (MongoDB Compatibility Fix)
    // Ensures that routes are linked to the current driver IDs by checking Plate/TC fallback
    for (const r of routes) {
      const currentDriver = drivers.find(d => String(d.id) === String(r.driverId));
      if (!currentDriver) {
        // ID mismatch! Try to find driver by name or plate if stored
        const reLinkedDriver = drivers.find(d => 
          (r.driverSnapshotName && d.name === r.driverSnapshotName)
        );
        if (reLinkedDriver) {
          await db.routes.update(r.id!, { driverId: String(reLinkedDriver.id) });
        }
      }
    }
  } catch (error) {
    console.error('Normalization error:', error);
  }
};

// Helper to prepare data before saving (encryption is now handled server-side)
const prepareData = (data: any) => {
  return data;
};

async function callApi(collection: string, operation: string, params: any = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');
  
  const token = await user.getIdToken();
  const response = await fetch('/api/db?t=' + Date.now(), {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      collection,
      operation,
      ...params
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API request failed');
  }

  return await response.json();
}

export const db = {
  households: {
    toArray: async () => {
      if (isDemoMode()) return MOCK.MOCK_HOUSEHOLDS;
      const data = await callApi('households', 'list');
      return data.map(processData) as Household[];
    },
    get: async (id: string) => {
      if (isDemoMode()) return MOCK.MOCK_HOUSEHOLDS.find(h => h.id === id) || null;
      const data = await callApi('households', 'get', { id });
      return processData(data) as Household;
    },
    add: async (data: Household) => {
      checkDemoMode();
      const res = await callApi('households', 'add', { data: prepareData(data) });
      notifyDbChange('households');
      revalidateData('households');
      return res.id;
    },
    put: async (data: Household) => {
      checkDemoMode();
      await callApi('households', 'put', { data: prepareData(data) });
      notifyDbChange('households');
      revalidateData('households');
    },
    update: async (id: string, data: Partial<Household>) => {
      checkDemoMode();
      await callApi('households', 'update', { id, data: prepareData(data) });
      notifyDbChange('households');
      revalidateData('households');
    },
    delete: async (id: string) => {
      checkDemoMode();
      await callApi('households', 'delete', { id });
      notifyDbChange('households');
      revalidateData('households');
    },
    where: (field: string) => ({
      equals: (val: any) => ({
        toArray: async () => {
          if (isDemoMode()) return MOCK.MOCK_HOUSEHOLDS.filter(h => (h as any)[field] === val);
          const data = await callApi('households', 'list', { query: { [field]: val } });
          return data.map(processData) as Household[];
        },
        first: async () => {
          if (isDemoMode()) return MOCK.MOCK_HOUSEHOLDS.find(h => (h as any)[field] === val) || null;
          const data = await callApi('households', 'list', { query: { [field]: val }, limit: 1 });
          return data.length > 0 ? processData(data[0]) as Household : null;
        },
        count: async () => {
          const data = await callApi('households', 'list', { query: { [field]: val } });
          return data.length;
        }
      })
    })
  },
  drivers: {
    toArray: async () => {
      if (isDemoMode()) return MOCK.MOCK_DRIVERS;
      const data = await callApi('drivers', 'list');
      return data.map(processData) as Driver[];
    },
    filter: (fn: (d: Driver) => boolean) => ({
      toArray: async () => {
        if (isDemoMode()) return MOCK.MOCK_DRIVERS.filter(fn);
        const all = await db.drivers.toArray();
        return all.filter(fn);
      }
    }),
    get: async (id: string) => {
      if (isDemoMode()) return MOCK.MOCK_DRIVERS.find(d => d.id === id) || null;
      const data = await callApi('drivers', 'get', { id });
      return processData(data) as Driver;
    },
    add: async (data: Driver) => {
      checkDemoMode();
      const res = await callApi('drivers', 'add', { data: prepareData(data) });
      notifyDbChange('drivers');
      revalidateData('drivers');
      return res.id;
    },
    put: async (data: Driver) => {
      checkDemoMode();
      await callApi('drivers', 'put', { data: prepareData(data) });
      notifyDbChange('drivers');
      revalidateData('drivers');
    },
    update: async (id: string, data: Partial<Driver>) => {
      checkDemoMode();
      await callApi('drivers', 'update', { id, data: prepareData(data) });
      notifyDbChange('drivers');
      revalidateData('drivers');
    },
    delete: async (id: string) => {
      checkDemoMode();
      await callApi('drivers', 'delete', { id });
      notifyDbChange('drivers');
      revalidateData('drivers');
    },
  },
  routes: {
    toArray: async () => {
      if (isDemoMode()) return MOCK.MOCK_ROUTES;
      const data = await callApi('routes', 'list');
      return data.map(processData) as Route[];
    },
    where: (field: string) => ({
      equals: (val: any) => ({
        toArray: async () => {
          if (isDemoMode()) return MOCK.MOCK_ROUTES.filter(r => (r as any)[field] === val);
          const data = await callApi('routes', 'list', { query: { [field]: val } });
          return data.map(processData) as Route[];
        },
        first: async () => {
          if (isDemoMode()) return MOCK.MOCK_ROUTES.find(r => (r as any)[field] === val) || null;
          const data = await callApi('routes', 'list', { query: { [field]: val }, limit: 1 });
          return data.length > 0 ? processData(data[0]) as Route : null;
        },
        count: async () => {
          const data = await callApi('routes', 'list', { query: { [field]: val } });
          return data.length;
        }
      }),
      notEqual: (val: any) => ({
        toArray: async () => {
          const data = await callApi('routes', 'list', { query: { [field]: { $ne: val } } });
          return data.map(processData) as Route[];
        }
      })
    }),
    filter: (fn: (r: Route) => boolean) => ({
      toArray: async () => {
        const all = await db.routes.toArray();
        return all.filter(fn);
      }
    }),
    get: async (id: string) => {
      const data = await callApi('routes', 'get', { id });
      return processData(data) as Route;
    },
    add: async (data: Route) => {
      checkDemoMode();
      const res = await callApi('routes', 'add', { data });
      notifyDbChange('routes');
      revalidateData('routes');
      return res.id;
    },
    update: async (id: string, data: Partial<Route>) => {
      checkDemoMode();
      await callApi('routes', 'update', { id, data });
      notifyDbChange('routes');
      revalidateData('routes');
    },
    delete: async (id: string) => {
      checkDemoMode();
      await callApi('routes', 'delete', { id });
      notifyDbChange('routes');
      revalidateData('routes');
    },
  },
  routeStops: {
    toArray: async () => {
      if (isDemoMode()) return MOCK.MOCK_ROUTE_STOPS;
      const data = await callApi('route_stops', 'list');
      return data.map(processData) as RouteStop[];
    },
    get: async (id: string) => {
      if (isDemoMode()) return MOCK.MOCK_ROUTE_STOPS.find(s => s.id === id) || null;
      const data = await callApi('route_stops', 'get', { id });
      return processData(data) as RouteStop;
    },
    where: ((queryArg: any) => {
      if (typeof queryArg === 'string') {
        return {
          equals: (val: any) => ({
            toArray: async () => {
              if (isDemoMode()) return MOCK.MOCK_ROUTE_STOPS.filter(s => (s as any)[queryArg] === val);
              const data = await callApi('route_stops', 'list', { query: { [queryArg]: val } });
              return data.map(processData) as RouteStop[];
            },
            sortBy: async (sortField: string) => {
              if (isDemoMode()) return [...MOCK.MOCK_ROUTE_STOPS.filter(s => (s as any)[queryArg] === val)].sort((a, b) => (a as any)[sortField] - (b as any)[sortField]);
              const data = await callApi('route_stops', 'list', { query: { [queryArg]: val }, sort: { [sortField]: 1 } });
              return data.map(processData) as RouteStop[];
            },
            delete: async () => {
              checkDemoMode();
              await callApi('route_stops', 'delete', { query: { [queryArg]: val } });
              notifyDbChange('route_stops');
              revalidateData('route_stops');
            }
          })
        };
      } else {
        return {
          delete: async () => {
            checkDemoMode();
            await callApi('route_stops', 'delete', { query: queryArg });
            notifyDbChange('route_stops');
            revalidateData('route_stops');
          }
        };
      }
    }) as any,
    bulkAdd: async (stops: RouteStop[]) => {
      checkDemoMode();
      await callApi('route_stops', 'bulkAdd', { data: stops });
      notifyDbChange('route_stops');
      revalidateData('route_stops');
    },
    update: async (id: string, data: Partial<RouteStop>) => {
      checkDemoMode();
      await callApi('route_stops', 'update', { id, data });
      notifyDbChange('route_stops');
      revalidateData('route_stops');
    },
    add: async (data: RouteStop) => {
      checkDemoMode();
      const res = await callApi('route_stops', 'add', { data });
      notifyDbChange('route_stops');
      revalidateData('route_stops');
      return res.id;
    },
    delete: async (id: string) => {
      checkDemoMode();
      await callApi('route_stops', 'delete', { id });
      notifyDbChange('route_stops');
      revalidateData('route_stops');
    },
  },
  routeTemplates: {
    toArray: async () => {
      const data = await callApi('route_templates', 'list');
      return data.map(processData) as RouteTemplate[];
    },
    where: (field: string) => ({
      equals: (val: any) => ({
        toArray: async () => {
          const data = await callApi('route_templates', 'list', { query: { [field]: val } });
          return data.map(processData) as RouteTemplate[];
        },
        first: async () => {
          const data = await callApi('route_templates', 'list', { query: { [field]: val }, limit: 1 });
          return data.length > 0 ? processData(data[0]) as RouteTemplate : null;
        },
        count: async () => {
          const data = await callApi('route_templates', 'list', { query: { [field]: val } });
          return data.length;
        }
      })
    }),
    add: async (data: RouteTemplate) => {
      checkDemoMode();
      const res = await callApi('route_templates', 'add', { data });
      notifyDbChange('route_templates');
      return res.id;
    },
    delete: async (id: string) => {
      checkDemoMode();
      await callApi('route_templates', 'delete', { id });
      notifyDbChange('route_templates');
    },
  },
  routeTemplateStops: {
    toArray: async () => {
      const data = await callApi('route_template_stops', 'list');
      return data.map(processData) as RouteTemplateStop[];
    },
    where: (field: string) => ({
      equals: (val: any) => ({
        toArray: async () => {
          const data = await callApi('route_template_stops', 'list', { query: { [field]: val } });
          return data.map(processData) as RouteTemplateStop[];
        },
        count: async () => {
          const data = await callApi('route_template_stops', 'list', { query: { [field]: val } });
          return data.length;
        },
        delete: async () => {
          checkDemoMode();
          await callApi('route_template_stops', 'delete', { query: { [field]: val } });
          notifyDbChange('route_template_stops');
        }
      })
    }),
    bulkAdd: async (stops: RouteTemplateStop[]) => {
      checkDemoMode();
      await callApi('route_template_stops', 'bulkAdd', { data: stops });
      notifyDbChange('route_template_stops');
    },
    add: async (data: RouteTemplateStop) => {
      checkDemoMode();
      const res = await callApi('route_template_stops', 'add', { data });
      notifyDbChange('route_template_stops');
      return res.id;
    },
    update: async (id: string, data: Partial<RouteTemplateStop>) => {
      checkDemoMode();
      await callApi('route_template_stops', 'update', { id, data });
      notifyDbChange('route_template_stops');
    },
    delete: async (id: string) => {
      checkDemoMode();
      await callApi('route_template_stops', 'delete', { id });
      notifyDbChange('route_template_stops');
    },
  },
  personnel: {
    toArray: async () => {
      if (isDemoMode()) return MOCK.MOCK_PERSONNEL;
      const data = await callApi('personnel', 'list');
      return data.map(processData) as Personnel[];
    },
    get: async (id: string) => {
      if (isDemoMode()) return MOCK.MOCK_PERSONNEL.find(p => p.id === id) || null;
      const data = await callApi('personnel', 'get', { id });
      return processData(data) as Personnel;
    },
    where: (field: string) => ({
      equals: (val: any) => ({
        toArray: async () => {
          if (isDemoMode()) return MOCK.MOCK_PERSONNEL.filter(p => (p as any)[field] === val);
          const data = await callApi('personnel', 'list', { query: { [field]: val } });
          return data.map(processData) as Personnel[];
        },
        first: async () => {
          if (isDemoMode()) return MOCK.MOCK_PERSONNEL.find(p => (p as any)[field] === val) || null;
          const data = await callApi('personnel', 'list', { query: { [field]: val }, limit: 1 });
          return data.length > 0 ? processData(data[0]) as Personnel : null;
        },
        count: async () => {
          const data = await callApi('personnel', 'list', { query: { [field]: val } });
          return data.length;
        }
      })
    }),
    add: async (data: Personnel) => {
      checkDemoMode();
      const res = await callApi('personnel', 'add', { data: prepareData(data) });
      notifyDbChange('personnel');
      return res.id;
    },
    update: async (id: string, data: Partial<Personnel>) => {
      checkDemoMode();
      await callApi('personnel', 'update', { id, data: prepareData(data) });
      notifyDbChange('personnel');
    },
    delete: async (id: string) => {
      checkDemoMode();
      await callApi('personnel', 'delete', { id });
      notifyDbChange('personnel');
    },
    count: async () => {
      const data = await callApi('personnel', 'list');
      return data.length;
    },
  },
  restore: async (data: any) => {
    return await callApi('all', 'restore', { data });
  },
  system_logs: {
    toArray: async () => {
      if (isDemoMode()) return MOCK.MOCK_LOGS;
      const data = await callApi('system_logs', 'list', { sort: { timestamp: -1 } });
      return data.map(processData) as SystemLog[];
    },
    add: async (data: SystemLog) => {
      if (isDemoMode()) return 'mock-log-id';
      const res = await callApi('system_logs', 'add', { data });
      notifyDbChange('system_logs');
      return res.id;
    },
    update: async (id: string, data: Partial<SystemLog>) => {
      checkDemoMode();
      await callApi('system_logs', 'update', { id, data });
      notifyDbChange('system_logs');
    },
    where: (field: string) => ({
      equals: (val: any) => ({
        toArray: async () => {
          if (isDemoMode()) return MOCK.MOCK_LOGS.filter(l => (l as any)[field] === val);
          const data = await callApi('system_logs', 'list', { query: { [field]: val }, sort: { timestamp: -1 } });
          return data.map(processData) as SystemLog[];
        },
        count: async () => {
          if (isDemoMode()) return MOCK.MOCK_LOGS.filter(l => (l as any)[field] === val).length;
          const data = await callApi('system_logs', 'list', { query: { [field]: val } });
          return data.length;
        }
      }),
      greaterThanOrEqual: (val: any) => ({
        toArray: async () => {
          if (isDemoMode()) return MOCK.MOCK_LOGS.filter(l => (l as any)[field] >= val);
          const data = await callApi('system_logs', 'list', { query: { [field]: { $gte: val } }, sort: { [field]: -1 } });
          return data.map(processData) as SystemLog[];
        }
      })
    })
  },
  working_days: {
    toArray: async () => {
      if (isDemoMode()) return MOCK.MOCK_WORKING_DAYS;
      const data = await callApi('working_days', 'list');
      return data.map(processData) as WorkingDay[];
    },
    where: (field: string) => ({
      equals: (val: any) => ({
        toArray: async () => {
          if (isDemoMode()) return MOCK.MOCK_WORKING_DAYS.filter(d => (d as any)[field] === val);
          const data = await callApi('working_days', 'list', { query: { [field]: val } });
          return data.map(processData) as WorkingDay[];
        },
        first: async () => {
          if (isDemoMode()) return MOCK.MOCK_WORKING_DAYS.find(d => (d as any)[field] === val) || null;
          const data = await callApi('working_days', 'list', { query: { [field]: val }, limit: 1 });
          return data.length > 0 ? processData(data[0]) as WorkingDay : null;
        },
        count: async () => {
          const data = await callApi('working_days', 'list', { query: { [field]: val } });
          return data.length;
        }
      })
    }),
    put: async (data: WorkingDay) => {
      checkDemoMode();
      if (data.id) {
        await callApi('working_days', 'put', { data });
      } else {
        await callApi('working_days', 'add', { data });
      }
      notifyDbChange('working_days');
    },
    bulkPut: async (days: WorkingDay[]) => {
      checkDemoMode();
      // Simple implementation: loop through days
      for (const day of days) {
        if (day.id) {
          await callApi('working_days', 'put', { data: day });
        } else {
          await callApi('working_days', 'add', { data: day });
        }
      }
      notifyDbChange('working_days');
    }
  },
  breadTracking: {
    toArray: async () => {
      if (isDemoMode()) return MOCK.MOCK_BREAD;
      const data = await callApi('bread_tracking', 'list');
      return data.map(processData) as BreadTracking[];
    },
    add: async (data: BreadTracking) => {
      checkDemoMode();
      const res = await callApi('bread_tracking', 'add', { data });
      notifyDbChange('bread_tracking');
      return res.id;
    },
    where: (field: string) => ({
      equals: (val: any) => ({
        first: async () => {
          if (isDemoMode()) return MOCK.MOCK_BREAD.find(b => (b as any)[field] === val) || null;
          const data = await callApi('bread_tracking', 'list', { query: { [field]: val }, limit: 1 });
          return data.length > 0 ? processData(data[0]) as BreadTracking : null;
        },
        count: async () => {
          const data = await callApi('bread_tracking', 'list', { query: { [field]: val } });
          return data.length;
        }
      })
    }),
    update: async (id: string, data: Partial<BreadTracking>) => {
      checkDemoMode();
      await callApi('bread_tracking', 'update', { id, data });
      notifyDbChange('bread_tracking');
    },
    delete: async (id: string) => {
      checkDemoMode();
      await callApi('bread_tracking', 'delete', { id });
      notifyDbChange('bread_tracking');
    }
  },
  leftover_food: {
    toArray: async () => {
      if (isDemoMode()) return [];
      const data = await callApi('leftover_food', 'list');
      return data.map(processData) as LeftoverFood[];
    },
    add: async (data: LeftoverFood) => {
      checkDemoMode();
      const res = await callApi('leftover_food', 'add', { data });
      notifyDbChange('leftover_food');
      return res.id;
    },
    where: (field: string) => ({
      equals: (val: any) => ({
        first: async () => {
          if (isDemoMode()) return null;
          const data = await callApi('leftover_food', 'list', { query: { [field]: val }, limit: 1 });
          return data.length > 0 ? processData(data[0]) as LeftoverFood : null;
        },
        toArray: async () => {
          if (isDemoMode()) return [];
          const data = await callApi('leftover_food', 'list', { query: { [field]: val } });
          return data.map(processData) as LeftoverFood[];
        }
      })
    }),
    update: async (id: string, data: Partial<LeftoverFood>) => {
      checkDemoMode();
      await callApi('leftover_food', 'update', { id, data });
      notifyDbChange('leftover_food');
    }
  },
  tenders: {
    toArray: async () => {
      if (isDemoMode()) return [];
      const data = await callApi('tenders', 'list', { sort: { createdAt: -1 } });
      return data.map(processData) as Tender[];
    },
    add: async (data: Tender) => {
      checkDemoMode();
      const res = await callApi('tenders', 'add', { data });
      notifyDbChange('tenders');
      return res.id;
    },
    update: async (id: string, data: Partial<Tender>) => {
      checkDemoMode();
      await callApi('tenders', 'update', { id, data });
      notifyDbChange('tenders');
    },
    delete: async (id: string) => {
      checkDemoMode();
      await callApi('tenders', 'delete', { id });
      notifyDbChange('tenders');
    }
  },
  system_settings: {
    get: async (id: string) => {
      const data = await callApi('system_settings', 'get', { id });
      return processData(data) as SystemSettings;
    },
    set: async (id: string, data: Partial<SystemSettings>) => {
      checkDemoMode();
      await callApi('system_settings', 'put', { data: { ...data, id } });
      notifyDbChange('system_settings');
    }
  },
  surveys: {
    toArray: async () => {
      if (isDemoMode()) return MOCK.MOCK_SURVEYS;
      const data = await callApi('surveys', 'list', { sort: { createdAt: -1 } });
      return data.map(processData) as Survey[];
    },
    get: async (id: string) => {
      if (isDemoMode()) return MOCK.MOCK_SURVEYS.find(s => s.id === id) || null;
      const data = await callApi('surveys', 'get', { id });
      return processData(data) as Survey;
    },
    add: async (data: Survey) => {
      checkDemoMode();
      const res = await callApi('surveys', 'add', { data });
      notifyDbChange('surveys');
      revalidateData('surveys');
      return res.id;
    },
    update: async (id: string, data: Partial<Survey>) => {
      checkDemoMode();
      await callApi('surveys', 'update', { id, data });
      notifyDbChange('surveys');
      revalidateData('surveys');
    },
    delete: async (id: string) => {
      checkDemoMode();
      await callApi('surveys', 'delete', { id });
      notifyDbChange('surveys');
      revalidateData('surveys');
    }
  },
  surveyResponses: {
    toArray: async () => {
      if (isDemoMode()) return MOCK.MOCK_SURVEY_RESPONSES;
      const data = await callApi('survey_responses', 'list', { sort: { createdAt: -1 } });
      return data.map(processData) as SurveyResponse[];
    },
    where: (field: string) => ({
      equals: (val: any) => ({
        toArray: async () => {
          if (isDemoMode()) return MOCK.MOCK_SURVEY_RESPONSES.filter(sr => (sr as any)[field] === val);
          const data = await callApi('survey_responses', 'list', { query: { [field]: val } });
          return data.map(processData) as SurveyResponse[];
        },
        first: async () => {
          if (isDemoMode()) return MOCK.MOCK_SURVEY_RESPONSES.find(sr => (sr as any)[field] === val) || null;
          const data = await callApi('survey_responses', 'list', { query: { [field]: val }, limit: 1 });
          return data.length > 0 ? processData(data[0]) as SurveyResponse : null;
        }
      })
    }),
    add: async (data: SurveyResponse) => {
      checkDemoMode();
      const res = await callApi('survey_responses', 'add', { data });
      notifyDbChange('survey_responses');
      revalidateData('survey_responses');
      return res.id;
    },
    update: async (id: string, data: Partial<SurveyResponse>) => {
      checkDemoMode();
      await callApi('survey_responses', 'update', { id, data });
      notifyDbChange('survey_responses');
      revalidateData('survey_responses');
    },
    delete: async (id: string) => {
      checkDemoMode();
      await callApi('survey_responses', 'delete', { id });
      notifyDbChange('survey_responses');
      revalidateData('survey_responses');
    }
  },
  transaction: async (mode: string, ...args: any[]) => {
    const callback = args[args.length - 1];
    await callback();
    notifyDbChange();
  }
};
