/**
 * Masks sensitive strings like TC No or Phone numbers for privacy.
 * Example: 12345678901 -> 123*****890
 */
export const maskSensitive = (text: string | undefined, visibleCount: number = 3): string => {
  if (!text) return '-';
  if (text.length <= visibleCount * 2) return text;
  
  const start = text.substring(0, visibleCount);
  const end = text.substring(text.length - visibleCount);
  const masked = '*'.repeat(text.length - visibleCount * 2);
  
  return `${start}${masked}${end}`;
};

/**
 * Validates if a string is a valid Turkish TC Identity Number.
 */
export const isValidTcNo = (tcNo: string): boolean => {
  if (!tcNo) return false;
  if (tcNo.length !== 11) return false;
  if (!/^\d+$/.test(tcNo)) return false;
  
  // Basic checksum (optional but recommended for high accuracy)
  const digits = tcNo.split('').map(Number);
  const n1 = digits[0], n2 = digits[1], n3 = digits[2], n4 = digits[3], n5 = digits[4],
        n6 = digits[5], n7 = digits[6], n8 = digits[7], n9 = digits[8], n10 = digits[9], n11 = digits[10];
  
  if (n1 === 0) return false;
  
  const sumOdd = n1 + n3 + n5 + n7 + n9;
  const sumEven = n2 + n4 + n6 + n8;
  
  if ((sumOdd * 7 - sumEven) % 10 !== n10) return false;
  if ((sumOdd + sumEven + n10) % 10 !== n11) return false;
  
  return true;
};
