import { db } from './lib/db';

async function checkCounts() {
  const drivers = await db.drivers.toArray();
  const templates = await db.routeTemplates.toArray();
  const templateStops = await db.routeTemplateStops.toArray();

  console.log('--- DRIVER & TEMPLATE COUNTS ---');
  for (const driver of drivers) {
    const template = templates.find(t => t.driverId === driver.id);
    if (template) {
      const stops = templateStops.filter(ts => ts.templateId === template.id);
      console.log(`Driver: ${driver.name} | ID: ${driver.id} | Template Stops: ${stops.length}`);
    } else {
      console.log(`Driver: ${driver.name} | ID: ${driver.id} | NO TEMPLATE`);
    }
  }
}

checkCounts();
