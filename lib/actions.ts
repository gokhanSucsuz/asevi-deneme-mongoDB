'use server';

import { revalidateTag } from 'next/cache';

export async function invalidateHouseholds() {
  revalidateTag('households', 'default');
}

export async function invalidateDrivers() {
  revalidateTag('drivers', 'default');
}

export async function invalidateRoutes() {
  revalidateTag('routes', 'default');
}

export async function invalidateSystemLogs() {
  revalidateTag('system_logs', 'default');
}

export async function invalidateAll() {
  revalidateTag('households', 'default');
  revalidateTag('drivers', 'default');
  revalidateTag('routes', 'default');
  revalidateTag('system_logs', 'default');
}
