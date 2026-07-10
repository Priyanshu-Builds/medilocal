import { z } from 'zod';

/** Dashboard (admin / pharmacy staff) email+password login. */
export const dashboardLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
export type DashboardLoginInput = z.infer<typeof dashboardLoginSchema>;

/** Medicine catalog search query. */
export const medicineSearchSchema = z.object({
  q: z.string().trim().min(2).max(80).optional(),
});
export type MedicineSearchInput = z.infer<typeof medicineSearchSchema>;
