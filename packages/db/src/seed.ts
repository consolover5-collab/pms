import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../../../.env") });
import { createDb } from "./connection";
import {
  properties,
  roomTypes,
  rooms,
  bookings,
  ratePlans,
  guests,
} from "./schema/index";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL required");

const db = createDb(DATABASE_URL);

async function seed() {
  console.log("Seeding database...");

  // Clear existing data (reverse FK order)
  await db.delete(bookings);
  await db.delete(ratePlans);
  await db.delete(rooms);
  await db.delete(roomTypes);
  await db.delete(guests);
  await db.delete(properties);

  // Fictional demo property
  const [property] = await db
    .insert(properties)
    .values({
      name: "Grand Baltic Hotel",
      code: "GBH",
      address: "Озёрный проезд, 2",
      city: "Калининград",
      country: "RU",
      timezone: "Europe/Kaliningrad",
      currency: "RUB",
      checkInTime: "14:00",
      checkOutTime: "12:00",
      numberOfRooms: 50,
      numberOfFloors: 7,
    })
    .returning();

  // Room types — our own codes, standard hotel categories
  const types = await db
    .insert(roomTypes)
    .values([
      {
        propertyId: property.id,
        name: "Standard Double",
        code: "STD",
        maxOccupancy: 2,
        baseRate: "4500.00",
        description: "Standard room with double bed",
        sortOrder: 1,
      },
      {
        propertyId: property.id,
        name: "Standard Twin",
        code: "STD_TWN",
        maxOccupancy: 2,
        baseRate: "4500.00",
        description: "Standard room with two single beds",
        sortOrder: 2,
      },
      {
        propertyId: property.id,
        name: "Superior",
        code: "SUP",
        maxOccupancy: 2,
        baseRate: "5500.00",
        description: "Superior room with city view",
        sortOrder: 3,
      },
      {
        propertyId: property.id,
        name: "Premium",
        code: "PRM",
        maxOccupancy: 2,
        baseRate: "6500.00",
        description: "Premium room with upgraded amenities",
        sortOrder: 4,
      },
      {
        propertyId: property.id,
        name: "Junior Suite",
        code: "JRS",
        maxOccupancy: 3,
        baseRate: "8500.00",
        description: "Junior suite with separate living area",
        sortOrder: 5,
      },
      {
        propertyId: property.id,
        name: "Suite",
        code: "STE",
        maxOccupancy: 4,
        baseRate: "12000.00",
        description: "Full suite with living room and bedroom",
        sortOrder: 6,
      },
    ])
    .returning();

  // Create a map for easy lookup
  const typeMap = Object.fromEntries(types.map((t) => [t.code, t.id]));

  // 50 rooms across floors 2-7
  const roomData: { roomNumber: string; floor: number; typeCode: string }[] =
    [];

  // Floor 2: rooms 201-214 (mix of STD and STD_TWN)
  for (let i = 201; i <= 214; i++) {
    roomData.push({
      roomNumber: String(i),
      floor: 2,
      typeCode: i % 3 === 0 ? "STD_TWN" : "STD",
    });
  }
  // Floors 3-5: rooms 301-510 (SUP and STD)
  for (let floor = 3; floor <= 5; floor++) {
    for (let i = 1; i <= 10; i++) {
      const num = floor * 100 + i;
      roomData.push({
        roomNumber: String(num),
        floor,
        typeCode: i % 2 === 0 ? "SUP" : "STD",
      });
    }
  }
  // Floor 6: Premium rooms
  for (let i = 601; i <= 606; i++) {
    roomData.push({ roomNumber: String(i), floor: 6, typeCode: "PRM" });
  }
  // Floor 7: Suites
  roomData.push({ roomNumber: "701", floor: 7, typeCode: "JRS" });
  roomData.push({ roomNumber: "702", floor: 7, typeCode: "JRS" });
  roomData.push({ roomNumber: "703", floor: 7, typeCode: "STE" });
  roomData.push({ roomNumber: "704", floor: 7, typeCode: "STE" });

  await db.insert(rooms).values(
    roomData.map((r) => ({
      propertyId: property.id,
      roomTypeId: typeMap[r.typeCode],
      roomNumber: r.roomNumber,
      floor: r.floor,
      housekeepingStatus: "clean",
      occupancyStatus: "vacant",
    })),
  );

  // Guests — fictional demo data
  const guestData = [
    { firstName: "Анна", lastName: "Петрова", email: "anna.p@example.com", phone: "+79211234567", nationality: "RU", gender: "F", language: "ru", dateOfBirth: "1985-03-15", vipStatus: null },
    { firstName: "Иван", lastName: "Сидоров", email: "ivan.s@example.com", phone: "+79219876543", nationality: "RU", gender: "M", language: "ru", dateOfBirth: "1978-07-22", vipStatus: 3 },
    { firstName: "John", lastName: "Smith", email: "j.smith@example.com", phone: "+441234567890", nationality: "GB", gender: "M", language: "en", dateOfBirth: "1990-11-30", vipStatus: null },
    { firstName: "Maria", lastName: "Garcia", email: "maria.g@example.com", phone: "+34612345678", nationality: "ES", gender: "F", language: "es", dateOfBirth: "1992-01-08", vipStatus: 2 },
    { firstName: "Дмитрий", lastName: "Козлов", email: null, phone: "+79031112233", nationality: "RU", gender: "M", language: "ru", dateOfBirth: null, vipStatus: null },
    { firstName: "Elena", lastName: "Mueller", email: "e.mueller@example.com", phone: "+4917612345678", nationality: "DE", gender: "F", language: "de", dateOfBirth: "1988-06-20", vipStatus: 1 },
    { firstName: "Олег", lastName: "Новиков", email: "oleg.n@example.com", phone: "+79165554433", nationality: "RU", gender: "M", language: "ru", dateOfBirth: "1975-12-01", vipStatus: 5 },
    { firstName: "Sophie", lastName: "Dubois", email: "sophie.d@example.com", phone: null, nationality: "FR", gender: "F", language: "fr", dateOfBirth: "1995-09-14", vipStatus: null },
    { firstName: "Алексей", lastName: "Волков", email: "a.volkov@example.com", phone: "+79261234567", nationality: "RU", gender: "M", language: "ru", dateOfBirth: "1982-04-25", vipStatus: null },
    { firstName: "Yuki", lastName: "Tanaka", email: "yuki.t@example.com", phone: "+81901234567", nationality: "JP", gender: "F", language: "en", dateOfBirth: "1993-08-11", vipStatus: null },
  ];

  await db.insert(guests).values(guestData);

  console.log(
    `Seeded: 1 property, ${types.length} room types, ${roomData.length} rooms, ${guestData.length} guests`,
  );
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
