import {
  CUSTOMER_CANCELLABLE_STATES,
  ORDER_STATES,
  ORDER_STATE_TRANSITIONS,
  TERMINAL_ORDER_STATES,
  canTransition,
  isTerminalOrderState,
  type OrderState,
} from '@medilocal/shared';
import { formatOrderCode, generateDeliveryOtp } from './order-code';

describe('order state machine (shared rules)', () => {
  it('allows the OTC happy path end to end', () => {
    const path: OrderState[] = [
      'PLACED',
      'ACCEPTED',
      'PACKED',
      'RIDER_ASSIGNED',
      'PICKED_UP',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i], path[i + 1])).toBe(true);
    }
  });

  it('routes prescription orders through RX_REVIEW', () => {
    expect(canTransition('PLACED', 'RX_REVIEW')).toBe(true);
    expect(canTransition('RX_REVIEW', 'ACCEPTED')).toBe(true);
    expect(canTransition('RX_REVIEW', 'RX_REJECTED')).toBe(true);
    expect(canTransition('RX_REVIEW', 'CANCELLED')).toBe(true);
  });

  it('rejects skipping states', () => {
    expect(canTransition('PLACED', 'DELIVERED')).toBe(false);
    expect(canTransition('PLACED', 'PACKED')).toBe(false);
    expect(canTransition('ACCEPTED', 'RIDER_ASSIGNED')).toBe(false);
    expect(canTransition('PACKED', 'OUT_FOR_DELIVERY')).toBe(false);
  });

  it('rejects moving backwards', () => {
    expect(canTransition('PACKED', 'PLACED')).toBe(false);
    expect(canTransition('OUT_FOR_DELIVERY', 'PICKED_UP')).toBe(false);
    expect(canTransition('ACCEPTED', 'RX_REVIEW')).toBe(false);
  });

  it('only allows UNDELIVERED (not CANCELLED) once the parcel is with the rider', () => {
    expect(canTransition('PICKED_UP', 'CANCELLED')).toBe(false);
    expect(canTransition('OUT_FOR_DELIVERY', 'CANCELLED')).toBe(false);
    expect(canTransition('PICKED_UP', 'UNDELIVERED')).toBe(true);
    expect(canTransition('OUT_FOR_DELIVERY', 'UNDELIVERED')).toBe(true);
  });

  it('terminal states have no exits', () => {
    for (const state of TERMINAL_ORDER_STATES) {
      expect(isTerminalOrderState(state)).toBe(true);
      expect(ORDER_STATE_TRANSITIONS[state]).toHaveLength(0);
      for (const to of ORDER_STATES) {
        expect(canTransition(state, to)).toBe(false);
      }
    }
  });

  it('every declared transition target is a real state', () => {
    for (const [from, targets] of Object.entries(ORDER_STATE_TRANSITIONS)) {
      expect(ORDER_STATES).toContain(from);
      for (const to of targets) expect(ORDER_STATES).toContain(to);
    }
  });

  it('customers may only self-cancel from states where CANCELLED is legal', () => {
    for (const state of CUSTOMER_CANCELLABLE_STATES) {
      expect(canTransition(state, 'CANCELLED')).toBe(true);
    }
    // …and never once a rider is carrying the parcel.
    expect(CUSTOMER_CANCELLABLE_STATES).not.toContain('PICKED_UP');
    expect(CUSTOMER_CANCELLABLE_STATES).not.toContain('OUT_FOR_DELIVERY');
  });
});

describe('order code + delivery OTP', () => {
  it('formats codes as ML-YYMMDD-SEQ', () => {
    expect(formatOrderCode(new Date(2026, 6, 10), 42)).toBe('ML-260710-0042');
    expect(formatOrderCode(new Date(2026, 0, 1), 1)).toBe('ML-260101-0001');
  });

  it('generates 4-digit OTPs (leading zeros preserved)', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateDeliveryOtp()).toMatch(/^\d{4}$/);
    }
  });
});
