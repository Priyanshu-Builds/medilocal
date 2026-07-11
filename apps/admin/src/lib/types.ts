import type { OrderState, PaymentState, PaymentMethod, RxStatus } from '@medilocal/shared';

export interface OrderListRow {
  id: string;
  code: string;
  state: OrderState;
  paymentState: PaymentState;
  paymentMethod: PaymentMethod;
  requiresRx: boolean;
  grandTotalInr: string;
  placedAt: string;
  user: { name: string | null; phone: string } | null;
  shop: { name: string } | null;
  assignment: { rider: { name: string } | null } | null;
}

export interface OrderItem {
  id: string;
  nameSnapshot: string;
  priceInrSnapshot: string;
  qty: number;
  accepted: boolean | null;
}

export interface OrderStatusHistoryRow {
  id: string;
  fromState: OrderState | null;
  toState: OrderState;
  note: string | null;
  actorType: string;
  createdAt: string;
}

export interface Refund {
  id: string;
  amountInr: string;
  status: string;
  reason: string | null;
  createdAt: string;
}

export interface Payment {
  id: string;
  method: PaymentMethod;
  status: string;
  amountInr: string;
  razorpayOrderId: string | null;
  refunds?: Refund[];
}

export interface OrderDetail {
  id: string;
  code: string;
  state: OrderState;
  paymentState: PaymentState;
  paymentMethod: PaymentMethod;
  requiresRx: boolean;
  deliveryOtp: string;
  addressSnapshot: {
    label?: string;
    line1: string;
    line2?: string | null;
    landmark?: string | null;
    pincode?: string | null;
  };
  itemsTotalInr: string;
  deliveryFeeInr: string;
  discountInr: string;
  grandTotalInr: string;
  placedAt: string;
  user: { id: string; name: string | null; phone: string } | null;
  shop: { id: string; name: string; addressLine: string; phone: string } | null;
  items: OrderItem[];
  statusHistory: OrderStatusHistoryRow[];
  prescriptions: { id: string; status: RxStatus; rejectionReason: string | null; createdAt: string }[];
  payments: Payment[];
  assignment: {
    status: string;
    rider: { name: string; phone: string } | null;
    codCollectedInr: string | null;
  } | null;
}

export interface Rider {
  id: string;
  name: string;
  phone: string;
  vehicleNo: string | null;
  isActive: boolean;
  cashInHandInr: string;
}
