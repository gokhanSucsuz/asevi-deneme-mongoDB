import { db } from './db';
import { User } from 'firebase/auth';

/**
 * Global logging utility for system operations.
 * Ensures logs are recorded even if personnel record is not fully loaded.
 */
export const addSystemLog = async (
  user: User | null,
  personnel: any | null,
  action: string,
  details: string = '',
  category: string = 'general'
) => {
  try {
    const personnelEmail = personnel?.email || user?.email || 'Bilinmeyen Email';
    const personnelName = personnel?.name || user?.displayName || user?.email?.split('@')[0] || 'Bilinmeyen Personel';

    await db.system_logs.add({
      action,
      details,
      category,
      personnelEmail,
      personnelName,
      timestamp: new Date()
    });
    
    console.log(`Log Recorded: ${action} - ${personnelName}`);
  } catch (error) {
    console.error('Failed to record system log:', error);
  }
};
