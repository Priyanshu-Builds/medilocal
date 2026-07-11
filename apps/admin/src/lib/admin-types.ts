export interface Zone {
  id: string;
  name: string;
  deliveryFeeInr: string;
  minOrderInr: string;
  codCapInr: string;
  city: { id: string; name: string; state: string };
}

export type ShopStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED';

export interface AdminShop {
  id: string;
  cityId: string;
  zoneId: string;
  name: string;
  licenseNo: string;
  gstin: string | null;
  phone: string;
  email: string | null;
  addressLine: string;
  lat: number;
  lng: number;
  commissionPct: string;
  status: ShopStatus;
  openTime: string | null;
  closeTime: string | null;
  zone?: { id: string; name: string };
  _count?: { inventory: number; staff: number };
}

export interface ShopStaff {
  id: string;
  name: string;
  email: string;
  phone: string;
  isPharmacist: boolean;
  pharmacistRegNo: string | null;
  isActive: boolean;
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
    mrpInr: string;
    schedule: string;
    rxRequired: boolean;
  };
}

export interface Medicine {
  id: string;
  name: string;
  brand: string | null;
  genericName: string | null;
  manufacturer: string | null;
  mrpInr: string;
  packSize: string | null;
  schedule: string;
  rxRequired: boolean;
  isActive: boolean;
}
