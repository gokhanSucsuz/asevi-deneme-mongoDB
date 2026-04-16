import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

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
