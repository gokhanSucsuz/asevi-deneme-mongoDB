import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function normalizeTurkish(text: string): string {
  if (!text) return "";
  return text
    .replace(/İ/g, "i")
    .replace(/I/g, "ı")
    .replace(/ı/g, "i")
    .replace(/I/g, "i") // just in case
    .replace(/Ş/g, "s")
    .replace(/ş/g, "s")
    .replace(/Ğ/g, "g")
    .replace(/ğ/g, "g")
    .replace(/Ç/g, "c")
    .replace(/ç/g, "c")
    .replace(/Ü/g, "u")
    .replace(/ü/g, "u")
    .replace(/Ö/g, "o")
    .replace(/ö/g, "o")
    .toLowerCase()
    .replace(/[iı]/g, "i")
    .replace(/[şs]/g, "s")
    .replace(/[ğg]/g, "g")
    .replace(/[çc]/g, "c")
    .replace(/[üu]/g, "u")
    .replace(/[öo]/g, "o");
}
