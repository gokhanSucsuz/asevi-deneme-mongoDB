import { unstable_cache } from 'next/cache';
import { getDb } from './mongodb';
import { decrypt } from './crypto';
import { Household, Route, RouteStop, Survey, SurveyResponse } from './db';

// Helper to convert MongoDB objects and decrypt sensitive fields
const processData = (data: any) => {
  if (!data) return data;
  const result = { ...data };
  
  if (result._id) {
    result.id = result._id.toString();
    delete result._id;
  }

  // Decrypt sensitive fields if they exist
  if (result.tcNo) result.tcNo = decrypt(result.tcNo);
  if (result.householdNo) result.householdNo = decrypt(result.householdNo);

  for (const key in result) {
    if (result[key] instanceof Date) {
      // Keep as Date for server-side processing, but Next.js might need plain objects
      // If this is for RSC, Dates are fine. If for client, they need to be strings.
      // The original code converted them to Dates.
    } else if (Array.isArray(result[key])) {
      result[key] = result[key].map(item => typeof item === 'object' ? processData(item) : item);
    } else if (typeof result[key] === 'object' && result[key] !== null) {
      result[key] = processData(result[key]);
    }
  }
  return result;
};

/**
 * Fetches all households from MongoDB.
 * Wrapped in unstable_cache for performance.
 */
export const getCachedHouseholds = unstable_cache(
  async () => {
    console.log('Fetching households from MongoDB (Cache Miss)');
    const db = await getDb();
    const docs = await db.collection('households').find({}).toArray();
    return docs.map(processData) as Household[];
  },
  ['households-list'],
  {
    tags: ['households'],
    revalidate: 3600 // 1 hour fallback
  }
);

/**
 * Fetches all routes from MongoDB.
 */
export const getCachedRoutes = unstable_cache(
  async () => {
    console.log('Fetching routes from MongoDB (Cache Miss)');
    const db = await getDb();
    const docs = await db.collection('routes').find({}).toArray();
    return docs.map(processData) as Route[];
  },
  ['routes-list'],
  {
    tags: ['routes'],
    revalidate: 3600
  }
);

/**
 * Fetches all route stops from MongoDB.
 */
export const getCachedRouteStops = unstable_cache(
  async () => {
    console.log('Fetching route stops from MongoDB (Cache Miss)');
    const db = await getDb();
    const docs = await db.collection('route_stops').find({}).toArray();
    return docs.map(processData) as RouteStop[];
  },
  ['route-stops-list'],
  {
    tags: ['route_stops'],
    revalidate: 3600
  }
);

/**
 * Combined data fetch for reports.
 */
export const getCachedReportData = unstable_cache(
  async (startDate: string, endDate: string) => {
    console.log(`Fetching report data for ${startDate} to ${endDate} (Cache Miss)`);
    const db = await getDb();
    
    // Fetch routes in date range
    const routes = await db.collection('routes')
      .find({ date: { $gte: startDate, $lte: endDate } })
      .toArray();
    const processedRoutes = routes.map(processData) as Route[];
    
    const routeIds = processedRoutes.map(r => r.id);
    if (routeIds.length === 0) return { routes: [], stops: [] };

    // Fetch stops for the routes found
    const stops = await db.collection('route_stops')
      .find({ routeId: { $in: routeIds } })
      .toArray();
    const processedStops = stops.map(processData) as RouteStop[];

    return {
      routes: processedRoutes,
      stops: processedStops
    };
  },
  ['report-data'],
  {
    tags: ['reports', 'routes', 'route_stops'],
    revalidate: 3600
  }
);

/**
 * Fetches all surveys from MongoDB.
 */
export const getCachedSurveys = unstable_cache(
  async () => {
    console.log('Fetching surveys from MongoDB (Cache Miss)');
    const db = await getDb();
    const docs = await db.collection('surveys').find({}).toArray();
    return docs.map(processData) as Survey[];
  },
  ['surveys-list'],
  {
    tags: ['surveys'],
    revalidate: 3600
  }
);

/**
 * Fetches all survey responses from MongoDB.
 */
export const getCachedSurveyResponses = unstable_cache(
  async () => {
    console.log('Fetching survey responses from MongoDB (Cache Miss)');
    const db = await getDb();
    const docs = await db.collection('survey_responses').find({}).toArray();
    return docs.map(processData) as SurveyResponse[];
  },
  ['survey-responses-list'],
  {
    tags: ['survey_responses'],
    revalidate: 3600
  }
);
