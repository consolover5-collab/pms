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

  // Guests — migrated from Opera PMS (anonymized production data)
  const guestData = [
    { firstName: "FN470", lastName: "LN470", email: "qwwixhpmik@hifqxmakjr.com", phone: "+78624065146", nationality: "DE", gender: "M", language: "en", vipStatus: 1 },
    { firstName: "FN1086", lastName: "LN1086", email: "nuvaxtqfdl@vqbgsrhhtm.com", phone: "+57231554221", nationality: "RU", gender: "F", language: "ru", vipStatus: 1 },
    { firstName: "FN568", lastName: "LN568", email: "motbsxbaov@bkdexfspzo.com", phone: "+35491178301", nationality: "RU", gender: "F", language: "ru", vipStatus: 2 },
    { firstName: "FN2070", lastName: "LN2070", email: "lcunsfgfey@seurjwqugg.com", phone: "+03687170473", nationality: "RU", gender: "F", language: "ru", vipStatus: 2 },
    { firstName: "FN802", lastName: "LN802", email: "evxoafhupn@dzfsaodebr.com", phone: "+10163015218", nationality: "RU", gender: "M", language: "ru", vipStatus: 3 },
    { firstName: "FN869", lastName: "LN869", email: "hhvmqamgzf@mmdsndbcsa.com", phone: "+38642417843", nationality: "RU", gender: "F", language: "ru", vipStatus: 3 },
    { firstName: "FN254", lastName: "LN254", email: "ntgfaoezmn@hrtzyjshru.com", phone: "+95296882573", nationality: "RU", gender: "M", language: "ru", vipStatus: 4 },
    { firstName: "FN1749", lastName: "LN1749", email: "slctobadiv@fufzpuoqfp.com", phone: "+53662234244", nationality: "PL", gender: "M", language: "en", vipStatus: 1 },
    { firstName: "FN5946", lastName: "LN5946", email: "qxkmwnmaqb@sptlmcgufj.com", phone: "+81184237969", nationality: "RU", gender: "M", language: "ru", vipStatus: 5 },
    { firstName: "FN7162", lastName: "LN7162", email: "vexfsovrpo@cbrbichbuv.com", phone: "+42678577858", nationality: "RU", gender: "M", language: "ru", vipStatus: 5 },
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
