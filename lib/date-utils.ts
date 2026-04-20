import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';

export const safeFormat = (date: any, formatStr: string) => {
  try {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    return format(d, formatStr, { locale: tr });
  } catch (e) {
    return '-';
  }
};

export const safeFormatTRT = (date: any, formatStr: string = 'dd.MM.yyyy HH:mm:ss') => {
  try {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    // Format explicitly in Europe/Istanbul timezone
    const formatted = formatInTimeZone(d, 'Europe/Istanbul', formatStr, { locale: tr });
    return formatted;
  } catch (e) {
    return '-';
  }
};
