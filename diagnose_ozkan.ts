import { db } from './lib/db';

async function diagnose() {
  console.log('--- DIAGNOSIS START ---');
  const drivers = await db.drivers.toArray();
  const ozkan = drivers.find(d => d.name.toUpperCase().includes('ÖZKAN'));
  
  if (!ozkan) {
    console.error('CRITICAL: Ozkan driver not found by name!');
    return;
  }
  
  console.log(`Ozkan Driver: ${ozkan.name}, ID: ${ozkan.id}, Active: ${ozkan.isActive}`);
  
  const template = await db.routeTemplates.where('driverId').equals(ozkan.id!).first();
  if (!template) {
    console.error(`CRITICAL: No template found for Ozkan ID ${ozkan.id}`);
  } else {
    const stops = await db.routeTemplateStops.where('templateId').equals(template.id!).toArray();
    console.log(`Template ID: ${template.id}, Stops Count: ${stops.length}`);
  }

  const today = '2026-04-22';
  const routesToday = await db.routes.where('date').equals(today).toArray();
  const ozkanRoute = routesToday.find(r => r.driverId === ozkan.id);
  
  if (ozkanRoute) {
    const stops = await db.routeStops.where('routeId').equals(ozkanRoute.id!).toArray();
    console.log(`Existing Route for Ozkan Today: ${ozkanRoute.id}, Status: ${ozkanRoute.status}, Stops: ${stops.length}`);
  } else {
    console.log('No existing route for Ozkan today found in DB.');
  }
  console.log('--- DIAGNOSIS END ---');
}

diagnose();
