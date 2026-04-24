'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getMaskedDemoHouseholds,
  getMaskedDemoRouteStops,
  demoRoutes,
  demoDrivers,
  demoPersonnel,
  demoSystemLogs,
  demoSurveys,
  demoSurveyResponses,
  demoBreadTracking,
  demoLeftoverFood,
  demoRouteTemplates,
  demoRouteTemplateStops
} from './demoData';

type Listener = (updatedTag?: string) => void;
const listeners = new Set<Listener>();

// Global cache for client-side queries
const queryCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

let debounceTimer: NodeJS.Timeout | null = null;
let pendingTags = new Set<string>();

export const notifyDbChange = (tag?: string) => {
  // Clear cache for the specific tag if provided
  if (tag) {
    pendingTags.add(tag);
    for (const key of queryCache.keys()) {
      if (key.startsWith(tag)) {
        queryCache.delete(key);
      }
    }
  } else {
    pendingTags.add('*');
    queryCache.clear();
  }

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const notifyAll = pendingTags.has('*');
    const tagsToNotify = new Set(pendingTags);
    pendingTags.clear();

    listeners.forEach(l => {
        if (notifyAll) {
            l();
        } else {
            tagsToNotify.forEach(t => l(t));
        }
    });
  }, 100); // 100ms debounce
};

export function useAppQuery<T>(action: () => Promise<T>, deps: any[] = [], tag?: string) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const actionRef = useRef(action);
  actionRef.current = action;

  const fetch = useCallback(async (force = false) => {
    const isDemo = typeof window !== 'undefined' && localStorage.getItem('isDemoUser') === 'true';
    if (isDemo && tag) {
      let demoData: any = [];
      if (tag === 'households') demoData = getMaskedDemoHouseholds();
      else if (tag === 'routes') demoData = demoRoutes;
      else if (tag === 'route_stops') demoData = getMaskedDemoRouteStops();
      else if (tag === 'drivers') demoData = demoDrivers;
      else if (tag === 'personnel') demoData = demoPersonnel;
      else if (tag === 'system_logs') demoData = demoSystemLogs;
      else if (tag === 'surveys') demoData = demoSurveys;
      else if (tag === 'survey_responses') demoData = demoSurveyResponses;
      else if (tag === 'bread_tracking') demoData = demoBreadTracking;
      else if (tag === 'leftover_food') demoData = demoLeftoverFood;
      else if (tag === 'system_settings') demoData = null;
      else if (tag === 'route_templates') demoData = demoRouteTemplates;
      else if (tag === 'route_template_stops') demoData = demoRouteTemplateStops;
      
      setData(demoData as T);
      setLoading(false);
      return;
    }

    const cacheKey = tag ? `${tag}-${JSON.stringify(deps)}` : null;
    
    if (!force && cacheKey) {
      const cached = queryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setData(cached.data);
        setLoading(false);
        return;
      }
    }

    try {
      const res = await actionRef.current();
      if (cacheKey) {
        queryCache.set(cacheKey, { data: res, timestamp: Date.now() });
      }
      setData(res);
    } catch (e) {
      console.error(e);
      // Fallback to cache if error occurs
      if (cacheKey) {
         const stale = queryCache.get(cacheKey);
         if (stale) {
            setData(stale.data);
            // Optional: toast.warn("Sunucu hatası: Eski veriler gösteriliyor.");
         }
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tag, ...deps]);

  useEffect(() => {
    fetch();
    const listener = (updatedTag?: string) => {
      // If a specific tag changed, only refetch if this query has NO tag, or if the tags match
      if (updatedTag && tag && updatedTag !== tag) {
         return; // Skip refetching because this hook is for a different tag
      }
      fetch(true); // Force fetch on DB change
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [fetch, tag]);

  return data;
}
