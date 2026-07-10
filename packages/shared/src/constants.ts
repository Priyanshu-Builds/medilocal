/**
 * Order lifecycle. RX_REVIEW only occurs when the order contains at least one
 * prescription-required item. Terminal states: DELIVERED, RX_REJECTED,
 * CANCELLED, UNDELIVERED.
 */
export const ORDER_STATES = [
  'PLACED',
  'RX_REVIEW',
  'ACCEPTED',
  'PACKED',
  'RIDER_ASSIGNED',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'RX_REJECTED',
  'CANCELLED',
  'UNDELIVERED',
] as const;
export type OrderState = (typeof ORDER_STATES)[number];

/** Allowed transitions — the single source of truth for the order state machine. */
export const ORDER_STATE_TRANSITIONS: Record<OrderState, readonly OrderState[]> = {
  PLACED: ['RX_REVIEW', 'ACCEPTED', 'CANCELLED'],
  RX_REVIEW: ['ACCEPTED', 'RX_REJECTED', 'CANCELLED'],
  ACCEPTED: ['PACKED', 'CANCELLED'],
  PACKED: ['RIDER_ASSIGNED', 'CANCELLED'],
  RIDER_ASSIGNED: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['OUT_FOR_DELIVERY', 'UNDELIVERED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'UNDELIVERED'],
  DELIVERED: [],
  RX_REJECTED: [],
  CANCELLED: [],
  UNDELIVERED: [],
};

export function canTransition(from: OrderState, to: OrderState): boolean {
  return ORDER_STATE_TRANSITIONS[from].includes(to);
}

/** Payment lifecycle is tracked separately from order state. */
export const PAYMENT_STATES = [
  'PENDING',
  'PAID',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'COD_DUE',
  'COD_COLLECTED',
] as const;
export type PaymentState = (typeof PAYMENT_STATES)[number];

export const PAYMENT_METHODS = ['RAZORPAY', 'COD'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const RX_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type RxStatus = (typeof RX_STATUSES)[number];

/**
 * Indian drug schedules relevant to e-pharmacy:
 * NONE = OTC, H/H1 = prescription required, X = never sold online.
 */
export const DRUG_SCHEDULES = ['NONE', 'H', 'H1', 'X'] as const;
export type DrugSchedule = (typeof DRUG_SCHEDULES)[number];

export const ADMIN_ROLES = ['SUPER_ADMIN', 'OPS', 'PHARMACIST', 'SUPPORT', 'FINANCE'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const DELIVERY_ASSIGNMENT_STATUSES = [
  'OFFERED',
  'ACCEPTED',
  'PICKED_UP',
  'DELIVERED',
  'CANCELLED',
] as const;
export type DeliveryAssignmentStatus = (typeof DELIVERY_ASSIGNMENT_STATUSES)[number];

/** Default per-zone config values (overridable per zone in DB). */
export const DEFAULTS = {
  deliveryFeeInr: 30,
  minOrderInr: 99,
  codCapInr: 1500,
} as const;
