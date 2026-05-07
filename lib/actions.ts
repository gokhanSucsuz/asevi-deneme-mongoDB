'use server';

import { revalidateTag } from 'next/cache';

export async function invalidateHouseholds() {
  revalidateTag('households');
}

export async function invalidateDrivers() {
  revalidateTag('drivers');
}

export async function invalidateRoutes() {
  revalidateTag('routes');
}

export async function invalidateSystemLogs() {
  revalidateTag('system_logs');
}

export async function invalidateAll() {
  revalidateTag('households');
  revalidateTag('drivers');
  revalidateTag('routes');
  revalidateTag('system_logs');
}
