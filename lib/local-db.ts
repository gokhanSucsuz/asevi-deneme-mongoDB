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

export class LocalRouteDatabase extends Dexie {
  offlineUpdates!: Table<OfflineStopUpdate>;

  constructor() {
    super('DriverLocalDB');
    this.version(1).stores({
      offlineUpdates: '++id, stopId, timestamp'
    });
  }
}

export const localDb = new LocalRouteDatabase();
