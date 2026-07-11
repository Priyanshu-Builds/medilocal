import type { OrderState, PaymentState } from '@medilocal/shared';

type Tone = 'slate' | 'indigo' | 'emerald' | 'amber' | 'red' | 'blue' | 'violet';

/** Board colour + human label per order state. */
export const ORDER_STATE_UI: Record<OrderState, { label: string; tone: Tone }> = {
  PLACED: { label: 'Placed', tone: 'blue' },
  RX_REVIEW: { label: 'Rx review', tone: 'violet' },
  ACCEPTED: { label: 'Accepted', tone: 'indigo' },
  PACKED: { label: 'Packed', tone: 'indigo' },
  RIDER_ASSIGNED: { label: 'Rider assigned', tone: 'amber' },
  PICKED_UP: { label: 'Picked up', tone: 'amber' },
  OUT_FOR_DELIVERY: { label: 'Out for delivery', tone: 'amber' },
  DELIVERED: { label: 'Delivered', tone: 'emerald' },
  RX_REJECTED: { label: 'Rx rejected', tone: 'red' },
  CANCELLED: { label: 'Cancelled', tone: 'red' },
  UNDELIVERED: { label: 'Undelivered', tone: 'red' },
};

export const PAYMENT_STATE_UI: Record<PaymentState, { label: string; tone: Tone }> = {
  PENDING: { label: 'Payment pending', tone: 'amber' },
  PAID: { label: 'Paid', tone: 'emerald' },
  PARTIALLY_REFUNDED: { label: 'Partially refunded', tone: 'amber' },
  REFUNDED: { label: 'Refunded', tone: 'slate' },
  COD_DUE: { label: 'COD due', tone: 'blue' },
  COD_COLLECTED: { label: 'COD collected', tone: 'emerald' },
};

/** Live-board grouping so the ops view reads left-to-right by lifecycle. */
export const BOARD_COLUMNS: { title: string; states: OrderState[] }[] = [
  { title: 'Needs attention', states: ['PLACED', 'RX_REVIEW'] },
  { title: 'In pharmacy', states: ['ACCEPTED', 'PACKED'] },
  { title: 'In delivery', states: ['RIDER_ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY'] },
  { title: 'Closed', states: ['DELIVERED', 'CANCELLED', 'RX_REJECTED', 'UNDELIVERED'] },
];
