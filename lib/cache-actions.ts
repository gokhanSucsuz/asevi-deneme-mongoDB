'use server';

import { revalidateTag } from 'next/cache';

/**
 * Server Action to revalidate specific cache tags.
 * This can be called from client components after a mutation.
 */
export async function revalidateData(tag: string) {
  revalidateTag(tag);
}

/**
 * Revalidate multiple tags at once.
 */
export async function revalidateMultipleData(tags: string[]) {
  tags.forEach(tag => revalidateTag(tag));
}
