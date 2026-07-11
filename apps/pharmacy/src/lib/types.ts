import type { OrderState, PaymentState, PaymentMethod, RxStatus } from '@medilocal/shared';

/** Shop-scoped order payload — note: deliveryOtp is intentionally omitted server-side. */
export interface ShopOrder {
  id: string;
  code: string;
  state: OrderState;
  paymentState: PaymentState;
  paymentMethod: PaymentMethod;
  requiresRx: boolean;
  itemsTotalInr: string;
  deliveryFeeInr: string;
  grandTotalInr: string;
  placedAt: string;
  addressSnapshot: { line1: string; landmark?: string | null; pincode?: string | null };
  user: { name: string | null; phone: string } | null;
  items: {
    id: string;
    nameSnapshot: string;
    priceInrSnapshot: string;
    qty: number;
    accepted: boolean | null;
  }[];
  prescriptions: { id: string; status: RxStatus; rejectionReason?: string | null }[];
}

export interface InventoryRow {
  id: string;
  medicineId: string;
  priceInr: string;
  inStock: boolean;
  medicine: {
    id: string;
    name: string;
    brand: string | null;
    genericName: string | null;
    mrpInr: string;
    schedule: string;
    rxRequired: boolean;
  };
}

export interface Medicine {
  id: string;
  name: string;
  brand: string | null;
  mrpInr: string;
  schedule: string;
  rxRequired: boolean;
}
