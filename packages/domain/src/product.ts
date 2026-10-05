import { z } from 'zod';

export const PRODUCT_IDS = ['roaster', 'hooks', 'colddm'] as const;
export type ProductId = (typeof PRODUCT_IDS)[number];
export const ProductIdSchema = z.enum(PRODUCT_IDS);

/** The product this repo ships. */
export const THIS_PRODUCT: ProductId = 'hooks';
