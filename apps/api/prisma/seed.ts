import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Common Indian pharmacy SKUs to make the catalog demo-able on day one.
// name / brand / generic / manufacturer / MRP / pack / schedule / rxRequired
const MEDICINES: Array<
  [string, string | null, string, string, number, string, 'NONE' | 'H' | 'H1', boolean]
> = [
  ['Dolo 650', 'Dolo', 'Paracetamol 650mg', 'Micro Labs', 33.6, 'Strip of 15 tablets', 'NONE', false],
  ['Crocin Advance', 'Crocin', 'Paracetamol 500mg', 'GSK', 20.0, 'Strip of 15 tablets', 'NONE', false],
  ['Azithral 500', 'Azithral', 'Azithromycin 500mg', 'Alembic', 132.0, 'Strip of 5 tablets', 'H1', true],
  ['Augmentin 625 Duo', 'Augmentin', 'Amoxicillin 500mg + Clavulanic Acid 125mg', 'GSK', 223.0, 'Strip of 10 tablets', 'H', true],
  ['Pan 40', 'Pan', 'Pantoprazole 40mg', 'Alkem', 128.0, 'Strip of 15 tablets', 'H', true],
  ['Okacet 10', 'Okacet', 'Cetirizine 10mg', 'Cipla', 17.0, 'Strip of 10 tablets', 'NONE', false],
  ['Electral Powder', 'Electral', 'Oral Rehydration Salts', 'FDC', 22.0, '21.8g sachet', 'NONE', false],
  ['Betadine 10% Ointment', 'Betadine', 'Povidone Iodine 10%', 'Win-Medicare', 135.0, '20g tube', 'NONE', false],
  ['Volini Spray', 'Volini', 'Diclofenac topical spray', 'Sun Pharma', 335.0, '100g can', 'NONE', false],
  ['Digene Gel Mint', 'Digene', 'Antacid gel', 'Abbott', 128.0, '200ml bottle', 'NONE', false],
  ['Ecosprin 75', 'Ecosprin', 'Aspirin 75mg', 'USV', 8.0, 'Strip of 14 tablets', 'H', true],
  ['Zincovit', 'Zincovit', 'Multivitamin + Zinc', 'Apex Laboratories', 105.0, 'Strip of 15 tablets', 'NONE', false],
];

async function main() {
  const passwordHash = bcrypt.hashSync('ChangeMe123!', 10);

  const city = await prisma.city.upsert({
    where: { id: 'seed-city' },
    update: {},
    create: { id: 'seed-city', name: 'Pilot Town', state: 'RENAME_ME' },
  });

  const zone = await prisma.zone.upsert({
    where: { id: 'seed-zone' },
    update: {},
    create: { id: 'seed-zone', cityId: city.id, name: 'Central' },
  });

  await prisma.adminUser.upsert({
    where: { email: 'admin@medilocal.local' },
    update: {},
    create: {
      email: 'admin@medilocal.local',
      name: 'Super Admin',
      passwordHash,
      role: 'SUPER_ADMIN',
    },
  });

  const shop = await prisma.shop.upsert({
    where: { id: 'seed-shop' },
    update: {},
    create: {
      id: 'seed-shop',
      cityId: city.id,
      zoneId: zone.id,
      name: 'Sri Balaji Medical Store',
      licenseNo: 'DL-DEMO-0001',
      phone: '9800000001',
      addressLine: 'Main Market Road',
      lat: 25.5941,
      lng: 85.1376,
      status: 'ACTIVE',
      openTime: '09:00',
      closeTime: '22:00',
    },
  });

  await prisma.shopStaff.upsert({
    where: { email: 'pharmacy@medilocal.local' },
    update: {},
    create: {
      shopId: shop.id,
      name: 'Demo Pharmacist',
      email: 'pharmacy@medilocal.local',
      phone: '9800000002',
      passwordHash,
      isPharmacist: true,
      pharmacistRegNo: 'PH-DEMO-0001',
    },
  });

  await prisma.rider.upsert({
    where: { phone: '9800000003' },
    update: {},
    create: { name: 'Demo Rider', phone: '9800000003', vehicleNo: 'XX00XX0000' },
  });

  for (const [name, brand, genericName, manufacturer, mrp, packSize, schedule, rxRequired] of MEDICINES) {
    const existing = await prisma.medicine.findFirst({ where: { name } });
    const medicine =
      existing ??
      (await prisma.medicine.create({
        data: { name, brand, genericName, manufacturer, mrpInr: mrp, packSize, schedule, rxRequired },
      }));

    await prisma.shopInventory.upsert({
      where: { shopId_medicineId: { shopId: shop.id, medicineId: medicine.id } },
      update: {},
      create: {
        shopId: shop.id,
        medicineId: medicine.id,
        priceInr: mrp, // shops start at MRP; they can discount below it
        inStock: true,
      },
    });
  }

  console.log('Seed complete:');
  console.log('  admin login    → admin@medilocal.local / ChangeMe123!');
  console.log('  pharmacy login → pharmacy@medilocal.local / ChangeMe123!');
  console.log(`  catalog        → ${MEDICINES.length} medicines stocked at "${shop.name}"`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
