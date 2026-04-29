import Dexie, { Table } from 'dexie';
import { RouteStop, Route, Household, Driver } from './db';

export interface OfflineStopUpdate {
  id?: number;
  stopId: string;
  status: 'delivered' | 'failed';
  issueReport?: string;
  deliveredAt: Date;
  timestamp: number;
  lat?: number;
  lng?: number;
}

export interface OfflineRouteUpdate {
  id?: number;
  routeId: string;
  isPaused: boolean;
  status?: string;
  startKm?: number;
  timestamp: number;
  history?: any[];
}

export class LocalRouteDatabase extends Dexie {
  offlineUpdates!: Table<OfflineStopUpdate>;
  offlineRouteUpdates!: Table<OfflineRouteUpdate>;
  
  cachedRoutes!: Table<Route>;
  cachedStops!: Table<RouteStop>;
  cachedHouseholds!: Table<Household>;
  cachedDrivers!: Table<Driver>;

  constructor() {
    super('DriverLocalDB');
    this.version(3).stores({
      offlineUpdates: '++id, stopId, timestamp',
      offlineRouteUpdates: '++id, routeId, timestamp',
      cachedRoutes: 'id, driverId, date',
      cachedStops: 'id, routeId, status, householdId',
      cachedHouseholds: 'id',
      cachedDrivers: 'id'
    });
  }
}

export const localDb = new LocalRouteDatabase();
