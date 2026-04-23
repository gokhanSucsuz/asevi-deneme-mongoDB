import Dexie, { Table } from 'dexie';
import { RouteStop } from './db';

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

  constructor() {
    super('DriverLocalDB');
    this.version(2).stores({
      offlineUpdates: '++id, stopId, timestamp',
      offlineRouteUpdates: '++id, routeId, timestamp'
    });
  }
}

export const localDb = new LocalRouteDatabase();
