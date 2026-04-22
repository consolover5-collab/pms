import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../../../.env") });
import { eq } from "drizzle-orm";
import { createDb } from "./connection";
import {
  properties,
  roomTypes,
  rooms,
  bookings,
  ratePlans,
  ratePlanRoomRates,
  profiles,
  businessDates,
  transactionCodes,
  folioTransactions,
  folioWindows,
  cashierSessions,
  users,
  sessions,
  bookingDailyDetails,
  packages,
  ratePlanPackages,
  hkTasks,
} from "./schema/index";
import bcrypt from "bcrypt";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL required");

const db = createDb(DATABASE_URL);

// Deterministic PRNG for reproducible seeds
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(2026);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const pickInt = (min: number, max: number) =>
  Math.floor(rand() * (max - min + 1)) + min;
const shuffle = <T>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Name pools
const firstM = [
  "Ivan", "Peter", "Alexander", "Nikolai", "Sergey", "Dmitry", "Maxim",
  "Alexey", "Andrey", "Mikhail", "Vladimir", "Pavel", "Denis", "Roman",
  "Viktor", "James", "John", "Robert", "Michael", "William", "David",
  "Thomas", "Richard", "Joseph", "Hans", "Karl", "Stefan", "Jan", "Piotr",
  "Lukas",
];
const firstF = [
  "Olga", "Elena", "Anna", "Maria", "Natalia", "Irina", "Tatiana",
  "Ekaterina", "Svetlana", "Julia", "Anastasia", "Daria", "Emma", "Olivia",
  "Sophia", "Isabella", "Charlotte", "Amelia", "Emily", "Greta", "Ingrid",
  "Ewa", "Helga", "Sofia", "Laura",
];
const lastNames = [
  "Ivanov", "Petrov", "Sidorov", "Kuznetsov", "Smirnov", "Popov", "Sokolov",
  "Lebedev", "Kozlov", "Novikov", "Morozov", "Volkov", "Fedorov", "Mikhailov",
  "Romanov", "Smith", "Johnson", "Williams", "Brown", "Jones", "Miller",
  "Davis", "Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Kowalski",
  "Nowak", "Wiśniewski",
];

const nationalityPool = [
  "RU", "RU", "RU", "RU", "RU", "RU", "RU", "DE", "DE", "PL", "PL",
  "LT", "LV", "BY", "FI", "EE", "SE", "UA", "GB", "US",
];
const languagePool = ["ru", "ru", "ru", "ru", "en", "en", "de", "en", "en", "pl"];
const vipPool: (string | null)[] = [
  null, null, null, null, null, null, null, null,
  "SILVER", "SILVER", "GOLD", "VIP",
];

async function seed() {
  console.log("Seeding database...");

  // Clear in reverse FK order
  // FK chain: folio_transactions.cashier_session_id → cashier_sessions.id
  // cashier_sessions.user_id → users.id
  // So: folio_transactions → cashier_sessions → users
  await db.delete(sessions);
  await db.delete(folioTransactions);
  await db.delete(cashierSessions);
  await db.delete(users);
  await db.delete(hkTasks);
  await db.delete(ratePlanPackages);
  await db.delete(packages);
  await db.delete(folioWindows);
  await db.delete(transactionCodes);
  await db.delete(businessDates);
  await db.delete(bookingDailyDetails);
  await db.delete(bookings);
  await db.delete(ratePlanRoomRates);
  await db.delete(ratePlans);
  await db.delete(rooms);
  await db.delete(roomTypes);
  await db.delete(profiles);
  await db.delete(properties);

  // ============ Room layout (build first so property.numberOfRooms stays in sync) ============
  const roomData: { roomNumber: string; floor: number; typeCode: string }[] = [];
  for (let i = 201; i <= 214; i++) {
    roomData.push({ roomNumber: String(i), floor: 2, typeCode: i % 3 === 0 ? "STD_TWN" : "STD" });
  }
  for (let floor = 3; floor <= 5; floor++) {
    for (let i = 1; i <= 10; i++) {
      const num = floor * 100 + i;
      roomData.push({ roomNumber: String(num), floor, typeCode: i % 2 === 0 ? "SUP" : "STD" });
    }
  }
  for (let i = 601; i <= 606; i++) roomData.push({ roomNumber: String(i), floor: 6, typeCode: "PRM" });
  roomData.push({ roomNumber: "701", floor: 7, typeCode: "JRS" });
  roomData.push({ roomNumber: "702", floor: 7, typeCode: "JRS" });
  roomData.push({ roomNumber: "703", floor: 7, typeCode: "STE" });
  roomData.push({ roomNumber: "704", floor: 7, typeCode: "STE" });

  // ============ Property ============
  const [property] = await db
    .insert(properties)
    .values({
      id: "ff1d9135-dfb9-4baa-be46-0e739cd26dad",
      name: "Grand Baltic Hotel",
      code: "GBH",
      address: "2 Lake Drive, Kaliningrad",
      city: "Kaliningrad",
      country: "RU",
      timezone: "Europe/Kaliningrad",
      currency: "RUB",
      checkInTime: "14:00",
      checkOutTime: "12:00",
      numberOfRooms: roomData.length,
      numberOfFloors: 7,
      taxRate: "20.00",
    })
    .returning();

  // ============ Room types ============
  const types = await db
    .insert(roomTypes)
    .values([
      { propertyId: property.id, name: "Standard Double", code: "STD", maxOccupancy: 2, baseRate: "4500.00", description: "Standard room with double bed", sortOrder: 1 },
      { propertyId: property.id, name: "Standard Twin", code: "STD_TWN", maxOccupancy: 2, baseRate: "4500.00", description: "Standard room with two single beds", sortOrder: 2 },
      { propertyId: property.id, name: "Superior", code: "SUP", maxOccupancy: 2, baseRate: "5500.00", description: "Superior room with city view", sortOrder: 3 },
      { propertyId: property.id, name: "Premium", code: "PRM", maxOccupancy: 2, baseRate: "6500.00", description: "Premium room with upgraded amenities", sortOrder: 4 },
      { propertyId: property.id, name: "Junior Suite", code: "JRS", maxOccupancy: 3, baseRate: "8500.00", description: "Junior suite with separate living area", sortOrder: 5 },
      { propertyId: property.id, name: "Suite", code: "STE", maxOccupancy: 4, baseRate: "12000.00", description: "Full suite with living room and bedroom", sortOrder: 6 },
    ])
    .returning();
  const typeMap = Object.fromEntries(types.map((t) => [t.code, t.id]));
  const typeBaseRate: Record<string, number> = Object.fromEntries(
    types.map((t) => [t.code, Number(t.baseRate)]),
  );

  const insertedRooms = await db
    .insert(rooms)
    .values(
      roomData.map((r) => ({
        propertyId: property.id,
        roomTypeId: typeMap[r.typeCode],
        roomNumber: r.roomNumber,
        floor: r.floor,
        housekeepingStatus: "clean",
        occupancyStatus: "vacant",
      })),
    )
    .returning();

  const roomsByType: Record<string, { id: string; number: string }[]> = {};
  for (const rt of types) roomsByType[rt.code] = [];
  for (const r of insertedRooms) {
    const type = types.find((t) => t.id === r.roomTypeId)!;
    roomsByType[type.code].push({ id: r.id, number: r.roomNumber });
  }

  // ============ Guest profiles (80 individuals) ============
  const guestProfileData = Array.from({ length: 80 }, (_, i) => {
    const isMale = rand() < 0.55;
    const fn = pick(isMale ? firstM : firstF);
    const ln = pick(lastNames);
    const phoneDigits = String(pickInt(0, 9999999)).padStart(7, "0");
    return {
      propertyId: property.id,
      type: "individual" as const,
      firstName: fn,
      lastName: ln,
      name: `${fn} ${ln}`,
      email: `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@example.com`,
      phone: `+7 ${pickInt(900, 999)} ${phoneDigits}`,
      nationality: pick(nationalityPool),
      gender: isMale ? "M" : "F",
      language: pick(languagePool),
      vipStatus: pick(vipPool),
    };
  });
  const insertedGuests = await db.insert(profiles).values(guestProfileData).returning();

  // ============ Companies (10) ============
  const companyBase = [
    { name: "Gazprom Transgaz", shortName: "Gazprom", taxId: "3906000001", creditLimit: "1500000.00", paymentTermDays: 30 },
    { name: "Lukoil PJSC", shortName: "Lukoil", taxId: "7708004767", creditLimit: "800000.00", paymentTermDays: 30 },
    { name: "Rosneft Kaliningrad", shortName: "Rosneft", taxId: "7706107510", creditLimit: "1200000.00", paymentTermDays: 45 },
    { name: "Baltic Lines LLC", shortName: "Baltic Lines", taxId: "3906012345", creditLimit: "500000.00", paymentTermDays: 30 },
    { name: "Westfilm Inc.", shortName: "Westfilm", taxId: "3906098765", creditLimit: "300000.00", paymentTermDays: 14 },
    { name: "Amber Factory", shortName: "Amber", taxId: "3906054321", creditLimit: "200000.00", paymentTermDays: 14 },
    { name: "Severstal", shortName: "Severstal", taxId: "3528000597", creditLimit: "1000000.00", paymentTermDays: 30 },
    { name: "IKBFU University", shortName: "IKBFU", taxId: "3906019067", creditLimit: "100000.00", paymentTermDays: 60 },
    { name: "Kaliningrad TEC-2", shortName: "TEC-2", taxId: "3906014124", creditLimit: "250000.00", paymentTermDays: 30 },
    { name: "Kozlov & Co.", shortName: "Kozlov", taxId: "3906077331", creditLimit: "50000.00", paymentTermDays: 14 },
  ];
  const insertedCompanies = await db
    .insert(profiles)
    .values(
      companyBase.map((c) => ({
        propertyId: property.id,
        type: "company" as const,
        name: c.name,
        shortName: c.shortName,
        taxId: c.taxId,
        registrationNumber: `1${pickInt(100000000000, 999999999999)}`,
        email: `corporate@${c.shortName.toLowerCase().replace(/[^a-z]/g, "")}.ru`,
        phone: `+7 4012 ${String(pickInt(100000, 999999))}`,
        address: `${pickInt(1, 99)} ${pick(["Lenin", "Mira", "Sovetskaya", "Pobedy"])} St, Kaliningrad`,
        creditLimit: c.creditLimit,
        paymentTermDays: c.paymentTermDays,
        contactPerson: `${pick(firstM)} ${pick(lastNames)}`,
      })),
    )
    .returning();

  // ============ Travel agents (6) ============
  const taBase = [
    { name: "Coral Travel", iataCode: "01-23456", commissionPercent: "10.00" },
    { name: "TEZ Tour", iataCode: "01-27890", commissionPercent: "12.00" },
    { name: "Anex Tour", iataCode: "02-11223", commissionPercent: "10.00" },
    { name: "Pegas Touristik", iataCode: "03-45678", commissionPercent: "8.00" },
    { name: "Baltic Travel Agency", iataCode: "BT1234", commissionPercent: "15.00" },
    { name: "Ost-Express GmbH", iataCode: "OE5678", commissionPercent: "10.00" },
  ];
  const insertedTAs = await db
    .insert(profiles)
    .values(
      taBase.map((ta) => ({
        propertyId: property.id,
        type: "travel_agent" as const,
        name: ta.name,
        iataCode: ta.iataCode,
        commissionPercent: ta.commissionPercent,
        email: `sales@${ta.name.toLowerCase().replace(/[^a-z]/g, "")}.com`,
        phone: `+7 495 ${pickInt(1000000, 9999999)}`,
        contactPerson: `${pick(firstM.concat(firstF))} ${pick(lastNames)}`,
      })),
    )
    .returning();

  // ============ Sources (4) ============
  const sourceBase: {
    name: string;
    sourceCode: string;
    channelType: "direct" | "ota" | "gds" | "corporate" | "walkin" | "other";
  }[] = [
    { name: "Booking.com", sourceCode: "BKNG", channelType: "ota" },
    { name: "Expedia", sourceCode: "EXPE", channelType: "ota" },
    { name: "Direct Phone", sourceCode: "PHONE", channelType: "direct" },
    { name: "Walk-in", sourceCode: "WALKIN", channelType: "walkin" },
  ];
  const insertedSources = await db
    .insert(profiles)
    .values(
      sourceBase.map((s) => ({
        propertyId: property.id,
        type: "source" as const,
        name: s.name,
        sourceCode: s.sourceCode,
        channelType: s.channelType,
      })),
    )
    .returning();

  // ============ Rate plans (5) ============
  const rateData = await db
    .insert(ratePlans)
    .values([
      { propertyId: property.id, code: "RACK", name: "Rack Rate", description: "Standard published rate", baseRate: "5000.00", isDefault: true, isActive: true },
      { propertyId: property.id, code: "PROMO", name: "Promotional Rate", description: "Discounted promotional rate", baseRate: "4000.00", isActive: true },
      { propertyId: property.id, code: "CORP", name: "Corporate Rate", description: "Corporate discount rate", baseRate: "4500.00", isActive: true },
      { propertyId: property.id, code: "BAR", name: "Best Available Rate", description: "Best available rate for the day", baseRate: "4700.00", isActive: true },
      { propertyId: property.id, code: "LONG", name: "Long Stay (7+ nights)", description: "Discount for stays of 7+ nights", baseRate: "3800.00", isActive: true },
    ])
    .returning();
  const rateMap = Object.fromEntries(rateData.map((r) => [r.code, r.id]));

  const rateMultiplier: Record<string, number> = {
    RACK: 1.0,
    PROMO: 0.85,
    CORP: 0.92,
    BAR: 0.95,
    LONG: 0.8,
  };

  // ============ Rate plan room matrix (5 × 6) ============
  const matrixRows: { ratePlanId: string; roomTypeId: string; amount: string }[] = [];
  for (const rp of rateData) {
    for (const rt of types) {
      const amount = Math.round(Number(rt.baseRate) * rateMultiplier[rp.code]);
      matrixRows.push({
        ratePlanId: rp.id,
        roomTypeId: rt.id,
        amount: amount.toFixed(2),
      });
    }
  }
  await db.insert(ratePlanRoomRates).values(matrixRows);

  // ============ Room allocation helpers ============
  const roomCal: Record<string, [string, string][]> = {};
  const overlap = (a: [string, string], b: [string, string]) =>
    a[0] < b[1] && b[0] < a[1];

  function findRoom(typeCode: string, checkIn: string, checkOut: string) {
    const candidates = shuffle(roomsByType[typeCode]);
    for (const r of candidates) {
      const cal = roomCal[r.id] || [];
      if (!cal.some((span) => overlap(span, [checkIn, checkOut]))) {
        roomCal[r.id] = [...cal, [checkIn, checkOut]];
        return r;
      }
    }
    return null;
  }

  // ============ Bookings generation ============
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const daysFromNow = (days: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return d;
  };
  const todayStr = fmt(today);

  const typePoolWeighted = [
    "STD", "STD", "STD", "STD", "STD_TWN", "STD_TWN",
    "SUP", "SUP", "SUP", "PRM", "PRM", "JRS", "STE",
  ];
  const ratePoolWeighted = [
    "RACK", "RACK", "PROMO", "PROMO", "CORP", "BAR", "BAR", "LONG",
  ];

  type BookingRow = {
    guestIdx: number;
    roomTypeCode: string;
    rateCode: string;
    checkIn: string;
    checkOut: string;
    status: string;
    adults: number;
    children: number;
    rateAmount: string;
    paymentMethod: string | null;
    roomId: string | null;
    companyIdx?: number;
    taIdx?: number;
    sourceIdx?: number;
    actualCheckIn?: Date | null;
    actualCheckOut?: Date | null;
    marketCode?: string;
  };
  const bookingsList: BookingRow[] = [];

  const amountFor = (typeCode: string, rateCode: string) =>
    Math.round(typeBaseRate[typeCode] * rateMultiplier[rateCode]).toFixed(2);

  // Past checked-out (last 60 days)
  for (let i = 0; i < 65; i++) {
    const startOffset = -pickInt(3, 60);
    const nights = pickInt(1, 5);
    const typeCode = pick(typePoolWeighted);
    const rateCode = pick(ratePoolWeighted);
    const ci = daysFromNow(startOffset);
    const co = daysFromNow(startOffset + nights);
    const room = findRoom(typeCode, fmt(ci), fmt(co));
    if (!room) continue;
    const aci = new Date(ci);
    aci.setHours(14 + pickInt(0, 4), pickInt(0, 59), 0, 0);
    const aco = new Date(co);
    aco.setHours(10 + pickInt(0, 2), pickInt(0, 59), 0, 0);
    bookingsList.push({
      guestIdx: pickInt(0, 79),
      roomTypeCode: typeCode,
      rateCode,
      checkIn: fmt(ci),
      checkOut: fmt(co),
      status: "checked_out",
      adults: rand() < 0.65 ? 1 : 2,
      children: rand() < 0.15 ? pickInt(1, 2) : 0,
      rateAmount: amountFor(typeCode, rateCode),
      paymentMethod: pick(["card", "cash", "card", "card", "bank_transfer"]),
      roomId: room.id,
      companyIdx: rand() < 0.2 ? pickInt(0, 9) : undefined,
      sourceIdx: rand() < 0.6 ? pickInt(0, 3) : undefined,
      actualCheckIn: aci,
      actualCheckOut: aco,
      marketCode: pick(["leisure", "corporate", "leisure", "leisure", "group"]),
    });
  }

  // Currently in-house (started 1–5 days ago, still here)
  for (let i = 0; i < 28; i++) {
    const startOffset = -pickInt(1, 5);
    const nights = Math.max(pickInt(2, 7), Math.abs(startOffset) + 1);
    const ci = daysFromNow(startOffset);
    const co = daysFromNow(startOffset + nights);
    if (fmt(co) <= todayStr) continue;
    const typeCode = pick(typePoolWeighted);
    const rateCode = pick(ratePoolWeighted);
    const room = findRoom(typeCode, fmt(ci), fmt(co));
    if (!room) continue;
    const aci = new Date(ci);
    aci.setHours(14 + pickInt(0, 4), pickInt(0, 59), 0, 0);
    bookingsList.push({
      guestIdx: pickInt(0, 79),
      roomTypeCode: typeCode,
      rateCode,
      checkIn: fmt(ci),
      checkOut: fmt(co),
      status: "checked_in",
      adults: rand() < 0.65 ? 1 : 2,
      children: rand() < 0.1 ? 1 : 0,
      rateAmount: amountFor(typeCode, rateCode),
      paymentMethod: pick(["card", "cash", "card"]),
      roomId: room.id,
      companyIdx: rand() < 0.3 ? pickInt(0, 9) : undefined,
      sourceIdx: rand() < 0.5 ? pickInt(0, 3) : undefined,
      actualCheckIn: aci,
      actualCheckOut: null,
      marketCode: pick(["leisure", "corporate", "leisure"]),
    });
  }

  // Arriving today (confirmed, room pre-assigned)
  for (let i = 0; i < 6; i++) {
    const nights = pickInt(1, 5);
    const typeCode = pick(typePoolWeighted);
    const rateCode = pick(ratePoolWeighted);
    const ci = daysFromNow(0);
    const co = daysFromNow(nights);
    const room = findRoom(typeCode, fmt(ci), fmt(co));
    if (!room) continue;
    bookingsList.push({
      guestIdx: pickInt(0, 79),
      roomTypeCode: typeCode,
      rateCode,
      checkIn: fmt(ci),
      checkOut: fmt(co),
      status: "confirmed",
      adults: rand() < 0.6 ? 1 : 2,
      children: 0,
      rateAmount: amountFor(typeCode, rateCode),
      paymentMethod: null,
      roomId: room.id,
      companyIdx: rand() < 0.2 ? pickInt(0, 9) : undefined,
      sourceIdx: rand() < 0.6 ? pickInt(0, 3) : undefined,
      actualCheckIn: null,
      actualCheckOut: null,
      marketCode: pick(["leisure", "corporate"]),
    });
  }

  // Departing today (checked_in, checkout today)
  for (let i = 0; i < 4; i++) {
    const startOffset = -pickInt(1, 3);
    const typeCode = pick(typePoolWeighted);
    const rateCode = pick(ratePoolWeighted);
    const ci = daysFromNow(startOffset);
    const co = daysFromNow(0);
    const room = findRoom(typeCode, fmt(ci), fmt(co));
    if (!room) continue;
    const aci = new Date(ci);
    aci.setHours(14 + pickInt(0, 4), pickInt(0, 59), 0, 0);
    bookingsList.push({
      guestIdx: pickInt(0, 79),
      roomTypeCode: typeCode,
      rateCode,
      checkIn: fmt(ci),
      checkOut: fmt(co),
      status: "checked_in",
      adults: rand() < 0.7 ? 1 : 2,
      children: 0,
      rateAmount: amountFor(typeCode, rateCode),
      paymentMethod: pick(["card", "cash"]),
      roomId: room.id,
      actualCheckIn: aci,
      actualCheckOut: null,
      marketCode: "leisure",
    });
  }

  // Future confirmed (next 30 days) — tape chart fill
  for (let i = 0; i < 55; i++) {
    const startOffset = pickInt(1, 30);
    const nights = pickInt(1, 7);
    const typeCode = pick(typePoolWeighted);
    const rateCode = pick(ratePoolWeighted);
    const ci = daysFromNow(startOffset);
    const co = daysFromNow(startOffset + nights);
    const room = findRoom(typeCode, fmt(ci), fmt(co));
    if (!room) continue;
    bookingsList.push({
      guestIdx: pickInt(0, 79),
      roomTypeCode: typeCode,
      rateCode,
      checkIn: fmt(ci),
      checkOut: fmt(co),
      status: "confirmed",
      adults: rand() < 0.6 ? 1 : 2,
      children: rand() < 0.15 ? pickInt(1, 2) : 0,
      rateAmount: amountFor(typeCode, rateCode),
      paymentMethod: null,
      roomId: room.id,
      companyIdx: rand() < 0.25 ? pickInt(0, 9) : undefined,
      taIdx: rand() < 0.1 ? pickInt(0, 5) : undefined,
      sourceIdx: rand() < 0.55 ? pickInt(0, 3) : undefined,
      actualCheckIn: null,
      actualCheckOut: null,
      marketCode: pick(["leisure", "corporate", "group", "leisure"]),
    });
  }

  // Cancelled (no room)
  for (let i = 0; i < 10; i++) {
    const startOffset = pickInt(-20, 20);
    const nights = pickInt(1, 5);
    const typeCode = pick(typePoolWeighted);
    const rateCode = pick(ratePoolWeighted);
    bookingsList.push({
      guestIdx: pickInt(0, 79),
      roomTypeCode: typeCode,
      rateCode,
      checkIn: fmt(daysFromNow(startOffset)),
      checkOut: fmt(daysFromNow(startOffset + nights)),
      status: "cancelled",
      adults: 1,
      children: 0,
      rateAmount: amountFor(typeCode, rateCode),
      paymentMethod: null,
      roomId: null,
      sourceIdx: rand() < 0.5 ? pickInt(0, 3) : undefined,
      actualCheckIn: null,
      actualCheckOut: null,
    });
  }

  // No-shows
  for (let i = 0; i < 5; i++) {
    const startOffset = -pickInt(1, 14);
    const typeCode = pick(typePoolWeighted);
    bookingsList.push({
      guestIdx: pickInt(0, 79),
      roomTypeCode: typeCode,
      rateCode: "RACK",
      checkIn: fmt(daysFromNow(startOffset)),
      checkOut: fmt(daysFromNow(startOffset + 1)),
      status: "no_show",
      adults: 1,
      children: 0,
      rateAmount: amountFor(typeCode, "RACK"),
      paymentMethod: "card",
      roomId: null,
      actualCheckIn: null,
      actualCheckOut: null,
    });
  }

  // Insert bookings
  let confSeq = 1;
  const bookingIds: string[] = [];
  for (const b of bookingsList) {
    const [inserted] = await db
      .insert(bookings)
      .values({
        propertyId: property.id,
        guestProfileId: insertedGuests[b.guestIdx].id,
        roomId: b.roomId,
        roomTypeId: typeMap[b.roomTypeCode],
        ratePlanId: rateMap[b.rateCode],
        confirmationNumber: `${property.code}-${String(confSeq++).padStart(6, "0")}`,
        checkInDate: b.checkIn,
        checkOutDate: b.checkOut,
        status: b.status,
        adults: b.adults,
        children: b.children,
        rateAmount: b.rateAmount,
        paymentMethod: b.paymentMethod,
        marketCode: b.marketCode,
        companyProfileId: b.companyIdx !== undefined ? insertedCompanies[b.companyIdx].id : null,
        agentProfileId: b.taIdx !== undefined ? insertedTAs[b.taIdx].id : null,
        sourceProfileId: b.sourceIdx !== undefined ? insertedSources[b.sourceIdx].id : null,
        actualCheckIn: b.actualCheckIn ?? null,
        actualCheckOut: b.actualCheckOut ?? null,
      })
      .returning({ id: bookings.id });
    bookingIds.push(inserted.id);
  }

  // ============ Daily details ============
  const dailyRows: {
    bookingId: string;
    stayDate: string;
    roomId: string | null;
    roomTypeId: string;
    ratePlanId: string | null;
    rateAmount: string;
    adults: number;
    children: number;
  }[] = [];
  for (let i = 0; i < bookingsList.length; i++) {
    const b = bookingsList[i];
    if (b.status === "cancelled" || b.status === "no_show") continue;
    const ci = new Date(b.checkIn + "T00:00:00");
    const co = new Date(b.checkOut + "T00:00:00");
    for (let d = new Date(ci); d < co; d.setDate(d.getDate() + 1)) {
      dailyRows.push({
        bookingId: bookingIds[i],
        stayDate: fmt(d),
        roomId: b.roomId,
        roomTypeId: typeMap[b.roomTypeCode],
        ratePlanId: rateMap[b.rateCode] ?? null,
        rateAmount: b.rateAmount,
        adults: b.adults,
        children: b.children,
      });
    }
  }
  for (let i = 0; i < dailyRows.length; i += 500) {
    await db.insert(bookingDailyDetails).values(dailyRows.slice(i, i + 500));
  }

  // ============ Rooms sync ============
  for (let i = 0; i < bookingsList.length; i++) {
    const b = bookingsList[i];
    if (b.status === "checked_in" && b.roomId) {
      await db
        .update(rooms)
        .set({
          occupancyStatus: "occupied",
          housekeepingStatus:
            rand() < 0.3 ? "dirty" : rand() < 0.5 ? "pickup" : "clean",
        })
        .where(eq(rooms.id, b.roomId));
    }
  }
  // Departing-today rooms → dirty
  for (let i = 0; i < bookingsList.length; i++) {
    const b = bookingsList[i];
    if (b.status === "checked_in" && b.checkOut === todayStr && b.roomId) {
      await db.update(rooms).set({ housekeepingStatus: "dirty" }).where(eq(rooms.id, b.roomId));
    }
  }
  // A few rooms OOO/OOS
  const oooCandidates = shuffle(insertedRooms).slice(0, 3);
  for (const r of oooCandidates) {
    const cal = roomCal[r.id] || [];
    const hasCurrent = cal.some(([f, t]) => f <= todayStr && todayStr < t);
    if (hasCurrent) continue;
    await db
      .update(rooms)
      .set({
        housekeepingStatus: rand() < 0.5 ? "out_of_order" : "out_of_service",
        occupancyStatus: "vacant",
        oooFromDate: fmt(daysFromNow(-1)),
        oooToDate: fmt(daysFromNow(2)),
        returnStatus: "clean",
      })
      .where(eq(rooms.id, r.id));
  }

  // ============ Business date ============
  const [bizDate] = await db
    .insert(businessDates)
    .values({ propertyId: property.id, date: todayStr, status: "open" })
    .returning();

  // ============ Transaction codes ============
  const adjCodes = await db
    .insert(transactionCodes)
    .values([
      { propertyId: property.id, code: "ADJ_ROOM", description: "Room Charge Adjustment", groupCode: "ADJUSTMENT", transactionType: "charge", isManualPostAllowed: true, sortOrder: 1 },
      { propertyId: property.id, code: "ADJ_FB", description: "F&B Adjustment", groupCode: "ADJUSTMENT", transactionType: "charge", isManualPostAllowed: true, sortOrder: 2 },
    ])
    .returning();
  const adjMap = Object.fromEntries(adjCodes.map((c) => [c.code, c.id]));

  await db.insert(transactionCodes).values([
    { propertyId: property.id, code: "ROOM", description: "Room Charge", groupCode: "ROOM", transactionType: "charge", isManualPostAllowed: false, adjustmentCodeId: adjMap["ADJ_ROOM"], sortOrder: 10 },
    { propertyId: property.id, code: "ROOM_TAX", description: "Room Tax", groupCode: "TAX", transactionType: "charge", isManualPostAllowed: false, sortOrder: 11 },
    { propertyId: property.id, code: "EXTRA_BED", description: "Extra Bed Charge", groupCode: "ROOM", transactionType: "charge", isManualPostAllowed: true, adjustmentCodeId: adjMap["ADJ_ROOM"], sortOrder: 12 },
    { propertyId: property.id, code: "NO_SHOW", description: "No-Show Charge", groupCode: "ROOM", transactionType: "charge", isManualPostAllowed: false, adjustmentCodeId: adjMap["ADJ_ROOM"], sortOrder: 13 },
    { propertyId: property.id, code: "PAY_CASH", description: "Cash Payment", groupCode: "PAYMENT", transactionType: "payment", isManualPostAllowed: true, sortOrder: 20 },
    { propertyId: property.id, code: "PAY_CARD", description: "Credit Card Payment", groupCode: "PAYMENT", transactionType: "payment", isManualPostAllowed: true, sortOrder: 21 },
    { propertyId: property.id, code: "PAY_TRANSFER", description: "Bank Transfer", groupCode: "PAYMENT", transactionType: "payment", isManualPostAllowed: true, sortOrder: 22 },
    { propertyId: property.id, code: "FB_REST", description: "Restaurant Charge", groupCode: "FB", transactionType: "charge", isManualPostAllowed: true, adjustmentCodeId: adjMap["ADJ_FB"], sortOrder: 30 },
    { propertyId: property.id, code: "FB_BAR", description: "Bar Charge", groupCode: "FB", transactionType: "charge", isManualPostAllowed: true, adjustmentCodeId: adjMap["ADJ_FB"], sortOrder: 31 },
    { propertyId: property.id, code: "MINIBAR", description: "Minibar Charge", groupCode: "FB", transactionType: "charge", isManualPostAllowed: true, adjustmentCodeId: adjMap["ADJ_FB"], sortOrder: 32 },
    { propertyId: property.id, code: "BREAKFAST", description: "Breakfast", groupCode: "FB", transactionType: "charge", isManualPostAllowed: true, adjustmentCodeId: adjMap["ADJ_FB"], sortOrder: 33 },
    { propertyId: property.id, code: "PARKING", description: "Parking", groupCode: "MISC", transactionType: "charge", isManualPostAllowed: true, sortOrder: 34 },
  ]);

  const allTxCodes = await db
    .select()
    .from(transactionCodes)
    .where(eq(transactionCodes.propertyId, property.id));
  const txCodeMap = Object.fromEntries(allTxCodes.map((c) => [c.code, c.id]));

  // ============ Packages ============
  const pkgData = await db
    .insert(packages)
    .values([
      { propertyId: property.id, code: "BKFST", name: "Breakfast", transactionCodeId: txCodeMap["BREAKFAST"], calculationRule: "per_person_per_night", amount: "800.00", postingRhythm: "every_night", isActive: true },
      { propertyId: property.id, code: "PARK", name: "Parking", transactionCodeId: txCodeMap["PARKING"], calculationRule: "per_night", amount: "500.00", postingRhythm: "every_night", isActive: true },
    ])
    .returning();
  const pkgMap = Object.fromEntries(pkgData.map((p) => [p.code, p.id]));

  await db.insert(ratePlanPackages).values([
    { ratePlanId: rateMap["RACK"], packageId: pkgMap["BKFST"], includedInRate: true },
    { ratePlanId: rateMap["CORP"], packageId: pkgMap["BKFST"], includedInRate: true },
    { ratePlanId: rateMap["BAR"], packageId: pkgMap["BKFST"], includedInRate: true },
  ]);

  // ============ Folio windows ============
  const windowRows: {
    bookingId: string;
    windowNumber: number;
    label: string;
    profileId: string;
  }[] = [];
  for (let i = 0; i < bookingsList.length; i++) {
    const b = bookingsList[i];
    if (b.status === "cancelled" || b.status === "no_show") continue;
    const guest = insertedGuests[b.guestIdx];
    windowRows.push({
      bookingId: bookingIds[i],
      windowNumber: 1,
      label: guest.name,
      profileId: guest.id,
    });
    if (b.companyIdx !== undefined) {
      const company = insertedCompanies[b.companyIdx];
      windowRows.push({
        bookingId: bookingIds[i],
        windowNumber: 2,
        label: company.name,
        profileId: company.id,
      });
    }
  }
  const insertedWindows = await db
    .insert(folioWindows)
    .values(windowRows)
    .returning();
  const windowByBooking: Record<string, Record<number, string>> = {};
  for (const w of insertedWindows) {
    windowByBooking[w.bookingId] ??= {};
    windowByBooking[w.bookingId][w.windowNumber] = w.id;
  }

  // ============ Users ============
  const insertedUsers = await db
    .insert(users)
    .values([
      { username: "admin", passwordHash: await bcrypt.hash("admin123", 10), role: "admin", propertyId: property.id },
      { username: "front", passwordHash: await bcrypt.hash("front123", 10), role: "front_desk", propertyId: property.id },
      { username: "hk", passwordHash: await bcrypt.hash("hk123", 10), role: "housekeeping", propertyId: property.id },
    ])
    .returning();
  const adminUser = insertedUsers.find((u) => u.username === "admin")!;

  // ============ Cashier session (open for today) ============
  const [cashierSession] = await db
    .insert(cashierSessions)
    .values({
      propertyId: property.id,
      userId: adminUser.id,
      cashierNumber: 1,
      openingBalance: "10000.00",
      status: "open",
    })
    .returning();

  // ============ Folio transactions ============
  const folioRows: {
    propertyId: string;
    bookingId: string;
    folioWindowId: string;
    cashierSessionId: string | null;
    businessDateId: string;
    transactionCodeId: string;
    debit: string;
    credit: string;
    description: string;
    isSystemGenerated: boolean;
    postedBy: string;
  }[] = [];

  for (let i = 0; i < bookingsList.length; i++) {
    const b = bookingsList[i];
    if (b.status !== "checked_in" && b.status !== "checked_out") continue;
    const windowId = windowByBooking[bookingIds[i]][1];
    if (!windowId) continue;

    const ci = new Date(b.checkIn + "T00:00:00");
    const boundary =
      b.status === "checked_out"
        ? new Date(b.checkOut + "T00:00:00")
        : today;

    let total = 0;
    for (let d = new Date(ci); d < boundary; d.setDate(d.getDate() + 1)) {
      folioRows.push({
        propertyId: property.id,
        bookingId: bookingIds[i],
        folioWindowId: windowId,
        cashierSessionId: null,
        businessDateId: bizDate.id,
        transactionCodeId: txCodeMap["ROOM"],
        debit: b.rateAmount,
        credit: "0",
        description: "Room Charge",
        isSystemGenerated: false,
        postedBy: "system",
      });
      total += Number(b.rateAmount);
      if (rand() < 0.4) {
        folioRows.push({
          propertyId: property.id,
          bookingId: bookingIds[i],
          folioWindowId: windowId,
          cashierSessionId: null,
          businessDateId: bizDate.id,
          transactionCodeId: txCodeMap["BREAKFAST"],
          debit: "800.00",
          credit: "0",
          description: "Breakfast",
          isSystemGenerated: false,
          postedBy: "system",
        });
        total += 800;
      }
      if (rand() < 0.15) {
        const code = pick(["MINIBAR", "FB_REST", "FB_BAR", "PARKING"]);
        const amt = pickInt(300, 2500);
        folioRows.push({
          propertyId: property.id,
          bookingId: bookingIds[i],
          folioWindowId: windowId,
          cashierSessionId: null,
          businessDateId: bizDate.id,
          transactionCodeId: txCodeMap[code],
          debit: amt.toFixed(2),
          credit: "0",
          description:
            code === "MINIBAR"
              ? "Minibar"
              : code === "FB_REST"
                ? "Restaurant"
                : code === "FB_BAR"
                  ? "Bar"
                  : "Parking",
          isSystemGenerated: false,
          postedBy: "front",
        });
        total += amt;
      }
    }

    if (b.status === "checked_out") {
      const payCode =
        b.paymentMethod === "cash"
          ? "PAY_CASH"
          : b.paymentMethod === "bank_transfer"
            ? "PAY_TRANSFER"
            : "PAY_CARD";
      folioRows.push({
        propertyId: property.id,
        bookingId: bookingIds[i],
        folioWindowId: windowId,
        cashierSessionId: cashierSession.id,
        businessDateId: bizDate.id,
        transactionCodeId: txCodeMap[payCode],
        debit: "0",
        credit: total.toFixed(2),
        description:
          payCode === "PAY_CASH"
            ? "Cash Payment"
            : payCode === "PAY_TRANSFER"
              ? "Bank Transfer"
              : "Credit Card Payment",
        isSystemGenerated: false,
        postedBy: "admin",
      });
    } else if (rand() < 0.35) {
      const paid = Math.round(total * 0.5);
      const payCode = pick(["PAY_CASH", "PAY_CARD"]);
      folioRows.push({
        propertyId: property.id,
        bookingId: bookingIds[i],
        folioWindowId: windowId,
        cashierSessionId: cashierSession.id,
        businessDateId: bizDate.id,
        transactionCodeId: txCodeMap[payCode],
        debit: "0",
        credit: paid.toFixed(2),
        description: payCode === "PAY_CASH" ? "Cash Payment" : "Credit Card Payment",
        isSystemGenerated: false,
        postedBy: "admin",
      });
    }
  }

  for (let i = 0; i < folioRows.length; i += 500) {
    await db.insert(folioTransactions).values(folioRows.slice(i, i + 500));
  }

  // ============ HK tasks ============
  const hkRows: {
    propertyId: string;
    roomId: string;
    businessDateId: string;
    taskType: string;
    priority: number;
    status: string;
    assignedTo: string | null;
    startedAt?: Date | null;
    completedAt?: Date | null;
  }[] = [];
  const hkAssignees = ["Anna", "Olga", "Maria", "Natalia"];
  const usedRooms = new Set<string>();

  for (let i = 0; i < bookingsList.length; i++) {
    const b = bookingsList[i];
    if (b.checkOut === todayStr && b.roomId && !usedRooms.has(b.roomId)) {
      const status = pick(["pending", "pending", "in_progress", "completed"]);
      const row: (typeof hkRows)[number] = {
        propertyId: property.id,
        roomId: b.roomId,
        businessDateId: bizDate.id,
        taskType: "checkout_clean",
        priority: rand() < 0.15 ? 1 : 0,
        status,
        assignedTo: pick([...hkAssignees, null]),
      };
      if (status === "in_progress") row.startedAt = new Date(Date.now() - pickInt(30, 120) * 60 * 1000);
      if (status === "completed") {
        row.startedAt = new Date(Date.now() - pickInt(90, 240) * 60 * 1000);
        row.completedAt = new Date(Date.now() - pickInt(1, 60) * 60 * 1000);
      }
      hkRows.push(row);
      usedRooms.add(b.roomId);
    }
  }
  for (let i = 0; i < bookingsList.length; i++) {
    const b = bookingsList[i];
    if (b.status === "checked_in" && b.roomId && !usedRooms.has(b.roomId) && rand() < 0.4) {
      hkRows.push({
        propertyId: property.id,
        roomId: b.roomId,
        businessDateId: bizDate.id,
        taskType: "stayover_clean",
        priority: 0,
        status: pick(["pending", "pending", "in_progress"]),
        assignedTo: pick([...hkAssignees, null]),
      });
      usedRooms.add(b.roomId);
    }
  }
  const vacantPool = insertedRooms.filter((r) => !usedRooms.has(r.id));
  for (const r of shuffle(vacantPool).slice(0, 6)) {
    hkRows.push({
      propertyId: property.id,
      roomId: r.id,
      businessDateId: bizDate.id,
      taskType: pick(["inspection", "deep_clean"]),
      priority: 0,
      status: "pending",
      assignedTo: rand() < 0.5 ? pick(hkAssignees) : null,
    });
  }
  if (hkRows.length > 0) await db.insert(hkTasks).values(hkRows);

  console.log(
    `Seeded: 1 property, ${types.length} room types, ${roomData.length} rooms, ` +
      `${insertedGuests.length} guests, ${insertedCompanies.length} companies, ` +
      `${insertedTAs.length} travel agents, ${insertedSources.length} sources, ` +
      `${rateData.length} rate plans, ${matrixRows.length} rate matrix rows, ` +
      `${bookingsList.length} bookings, ${dailyRows.length} daily details, ` +
      `${14} transaction codes, ${pkgData.length} packages, ` +
      `${insertedWindows.length} folio windows, ${folioRows.length} folio tx, ` +
      `${hkRows.length} hk tasks, 1 cashier session, 3 users`,
  );
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
