import { auth } from '../firebase';
import { notifyDbChange } from './hooks';
import { encrypt, decrypt } from './crypto';
import { revalidateData } from './cache-actions';

// Helper to check demo mode
const checkDemoMode = () => {
  if (typeof window !== 'undefined' && localStorage.getItem('isDemoUser') === 'true') {
    throw new Error('Demo sürümünde veri değişikliği yapılamaz');
  }
};

// Types
export interface HouseholdHistory {
  action: 'created' | 'updated' | 'paused' | 'activated' | 'deleted' | 'route_changed';
  date: Date;
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
  vehiclePlate: string;
  isActive: boolean;
}

export interface RouteHistory {
  action: string;
  date: Date;
  note?: string;
  personnelName?: string;
}

export interface Route {
  id?: string;
  driverId: string;
  driverSnapshotName?: string;
  date: string;
  status: 'pending' | 'in_progress' | 'completed' | 'approved';
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
  
  const result = Array.isArray(data) ? [...data] : { ...data };
  
  // Decrypt sensitive fields if they exist at this level
  if (result.tcNo) result.tcNo = decrypt(result.tcNo);
  if (result.householdNo) result.householdNo = decrypt(result.householdNo);
  if (result.phone) result.phone = decrypt(result.phone);
  if (result.address) result.address = decrypt(result.address);

  const dateFields = [
    'createdAt', 'updatedAt', 'timestamp', 'submittedAt', 
    'lastBackupDate', 'deliveredAt', 'personnelCompletionTime', 'date'
  ];

  for (const key in result) {
    const value = result[key];
    if (typeof value === 'string' && (key.endsWith('At') || dateFields.includes(key))) {
      // Try to parse date if it looks like one
      if (value.includes('T') || value.includes('-')) {
        const d = new Date(value);
        if (!isNaN(d.getTime())) result[key] = d;
      }
    } else if (typeof value === 'object' && value !== null) {
      result[key] = processData(value);
    }
  }
  return result;
};

// Helper to encrypt sensitive fields before saving
const prepareData = (data: any) => {
  if (!data) return data;
  const result = { ...data };
  if (result.tcNo) result.tcNo = encrypt(result.tcNo);
  if (result.householdNo) result.householdNo = encrypt(result.householdNo);
  if (result.phone) result.phone = encrypt(result.phone);
  if (result.address) result.address = encrypt(result.address);
  if (result.password) result.password = encrypt(result.password);
  return result;
};

async function callApi(collection: string, operation: string, params: any = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');
  
  const token = await user.getIdToken();
  const response = await fetch('/api/db', {
    method: 'POST',
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
      const data = await callApi('households', 'list');
      return data.map(processData) as Household[];
    },
    get: async (id: string) => {
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
          const searchVal = (field === 'tcNo' || field === 'householdNo') ? encrypt(val) : val;
          const data = await callApi('households', 'list', { query: { [field]: searchVal } });
          return data.map(processData) as Household[];
        },
        first: async () => {
          const searchVal = (field === 'tcNo' || field === 'householdNo') ? encrypt(val) : val;
          const data = await callApi('households', 'list', { query: { [field]: searchVal }, limit: 1 });
          return data.length > 0 ? processData(data[0]) as Household : null;
        }
      })
    })
  },
  drivers: {
    toArray: async () => {
      const data = await callApi('drivers', 'list');
      return data.map(processData) as Driver[];
    },
    filter: (fn: (d: Driver) => boolean) => ({
      toArray: async () => {
        const all = await db.drivers.toArray();
        return all.filter(fn);
      }
    }),
    get: async (id: string) => {
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
      const data = await callApi('routes', 'list');
      return data.map(processData) as Route[];
    },
    where: (field: string) => ({
      equals: (val: any) => ({
        toArray: async () => {
          const data = await callApi('routes', 'list', { query: { [field]: val } });
          return data.map(processData) as Route[];
        },
        first: async () => {
          const data = await callApi('routes', 'list', { query: { [field]: val }, limit: 1 });
          return data.length > 0 ? processData(data[0]) as Route : null;
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
      const data = await callApi('route_stops', 'list');
      return data.map(processData) as RouteStop[];
    },
    get: async (id: string) => {
      const data = await callApi('route_stops', 'get', { id });
      return processData(data) as RouteStop;
    },
    where: ((queryArg: any) => {
      if (typeof queryArg === 'string') {
        return {
          equals: (val: any) => ({
            toArray: async () => {
              const data = await callApi('route_stops', 'list', { query: { [queryArg]: val } });
              return data.map(processData) as RouteStop[];
            },
            sortBy: async (sortField: string) => {
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
      const data = await callApi('personnel', 'list');
      return data.map(processData) as Personnel[];
    },
    get: async (id: string) => {
      const data = await callApi('personnel', 'get', { id });
      return processData(data) as Personnel;
    },
    where: (field: string) => ({
      equals: (val: any) => ({
        toArray: async () => {
          const searchVal = (field === 'tcNo') ? encrypt(val) : val;
          const data = await callApi('personnel', 'list', { query: { [field]: searchVal } });
          return data.map(processData) as Personnel[];
        },
        first: async () => {
          const searchVal = (field === 'tcNo') ? encrypt(val) : val;
          const data = await callApi('personnel', 'list', { query: { [field]: searchVal }, limit: 1 });
          return data.length > 0 ? processData(data[0]) as Personnel : null;
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
      const data = await callApi('system_logs', 'list', { sort: { timestamp: -1 } });
      return data.map(processData) as SystemLog[];
    },
    add: async (data: SystemLog) => {
      checkDemoMode();
      const res = await callApi('system_logs', 'add', { data });
      notifyDbChange('system_logs');
      return res.id;
    },
    where: (field: string) => ({
      equals: (val: any) => ({
        toArray: async () => {
          const data = await callApi('system_logs', 'list', { query: { [field]: val }, sort: { timestamp: -1 } });
          return data.map(processData) as SystemLog[];
        }
      }),
      greaterThanOrEqual: (val: any) => ({
        toArray: async () => {
          const data = await callApi('system_logs', 'list', { query: { [field]: { $gte: val } }, sort: { [field]: -1 } });
          return data.map(processData) as SystemLog[];
        }
      })
    })
  },
  working_days: {
    toArray: async () => {
      const data = await callApi('working_days', 'list');
      return data.map(processData) as WorkingDay[];
    },
    where: (field: string) => ({
      equals: (val: any) => ({
        toArray: async () => {
          const data = await callApi('working_days', 'list', { query: { [field]: val } });
          return data.map(processData) as WorkingDay[];
        },
        first: async () => {
          const data = await callApi('working_days', 'list', { query: { [field]: val }, limit: 1 });
          return data.length > 0 ? processData(data[0]) as WorkingDay : null;
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
          const data = await callApi('bread_tracking', 'list', { query: { [field]: val }, limit: 1 });
          return data.length > 0 ? processData(data[0]) as BreadTracking : null;
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
          const data = await callApi('leftover_food', 'list', { query: { [field]: val }, limit: 1 });
          return data.length > 0 ? processData(data[0]) as LeftoverFood : null;
        },
        toArray: async () => {
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
      const data = await callApi('surveys', 'list', { sort: { createdAt: -1 } });
      return data.map(processData) as Survey[];
    },
    get: async (id: string) => {
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
      const data = await callApi('survey_responses', 'list', { sort: { createdAt: -1 } });
      return data.map(processData) as SurveyResponse[];
    },
    where: (field: string) => ({
      equals: (val: any) => ({
        toArray: async () => {
          const data = await callApi('survey_responses', 'list', { query: { [field]: val } });
          return data.map(processData) as SurveyResponse[];
        },
        first: async () => {
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
