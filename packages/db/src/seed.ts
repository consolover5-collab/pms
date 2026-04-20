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

async function seed() {
  console.log("Seeding database...");

  // Clear existing data (reverse FK order)
  await db.delete(sessions);
  await db.delete(users);
  await db.delete(hkTasks);
  await db.delete(ratePlanPackages);
  await db.delete(packages);
  await db.delete(folioTransactions);
  await db.delete(cashierSessions);
  await db.delete(folioWindows);
  await db.delete(transactionCodes);
  await db.delete(businessDates);
  await db.delete(bookingDailyDetails);
  await db.delete(bookings);
  await db.delete(ratePlans);
  await db.delete(rooms);
  await db.delete(roomTypes);
  await db.delete(profiles);
  await db.delete(properties);

  // Fictional demo property — fixed UUID for test stability
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
      numberOfRooms: 50,
      numberOfFloors: 7,
      taxRate: "20.00",
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

  const roomMap = Object.fromEntries(
    insertedRooms.map((r) => [r.roomNumber, r.id]),
  );

  // Guests — migrated from Opera PMS (anonymized production data)
  const profileData = [
    { propertyId: property.id, type: "individual" as const, firstName: "FN470", lastName: "LN470", name: "FN470 LN470", email: "qwwixhpmik@hifqxmakjr.com", phone: "+78624065146", nationality: "DE", gender: "M", language: "en", vipStatus: "SILVER" },
    { propertyId: property.id, type: "individual" as const, firstName: "FN1086", lastName: "LN1086", name: "FN1086 LN1086", email: "nuvaxtqfdl@vqbgsrhhtm.com", phone: "+57231554221", nationality: "RU", gender: "F", language: "ru", vipStatus: "SILVER" },
    { propertyId: property.id, type: "individual" as const, firstName: "FN568", lastName: "LN568", name: "FN568 LN568", email: "motbsxbaov@bkdexfspzo.com", phone: "+35491178301", nationality: "RU", gender: "F", language: "ru", vipStatus: "GOLD" },
    { propertyId: property.id, type: "individual" as const, firstName: "FN2070", lastName: "LN2070", name: "FN2070 LN2070", email: "lcunsfgfey@seurjwqugg.com", phone: "+03687170473", nationality: "RU", gender: "F", language: "ru", vipStatus: "GOLD" },
    { propertyId: property.id, type: "individual" as const, firstName: "FN802", lastName: "LN802", name: "FN802 LN802", email: "evxoafhupn@dzfsaodebr.com", phone: "+10163015218", nationality: "RU", gender: "M", language: "ru", vipStatus: "VIP" },
    { propertyId: property.id, type: "individual" as const, firstName: "FN869", lastName: "LN869", name: "FN869 LN869", email: "hhvmqamgzf@mmdsndbcsa.com", phone: "+38642417843", nationality: "RU", gender: "F", language: "ru", vipStatus: "VIP" },
    { propertyId: property.id, type: "individual" as const, firstName: "FN254", lastName: "LN254", name: "FN254 LN254", email: "ntgfaoezmn@hrtzyjshru.com", phone: "+95296882573", nationality: "RU", gender: "M", language: "ru", vipStatus: "VIP" },
    { propertyId: property.id, type: "individual" as const, firstName: "FN1749", lastName: "LN1749", name: "FN1749 LN1749", email: "slctobadiv@fufzpuoqfp.com", phone: "+53662234244", nationality: "PL", gender: "M", language: "en", vipStatus: "SILVER" },
    { propertyId: property.id, type: "individual" as const, firstName: "FN5946", lastName: "LN5946", name: "FN5946 LN5946", email: "qxkmwnmaqb@sptlmcgufj.com", phone: "+81184237969", nationality: "RU", gender: "M", language: "ru", vipStatus: "VIP" },
    { propertyId: property.id, type: "individual" as const, firstName: "FN7162", lastName: "LN7162", name: "FN7162 LN7162", email: "vexfsovrpo@cbrbichbuv.com", phone: "+42678577858", nationality: "RU", gender: "M", language: "ru", vipStatus: "VIP" },
  ];

  const insertedGuests = await db.insert(profiles).values(profileData).returning();

  // Rate plans
  const rateData = await db
    .insert(ratePlans)
    .values([
      {
        propertyId: property.id,
        code: "RACK",
        name: "Rack Rate",
        description: "Standard published rate",
        baseRate: "5000.00",
        isActive: true,
      },
      {
        propertyId: property.id,
        code: "PROMO",
        name: "Promotional Rate",
        description: "Discounted promotional rate",
        baseRate: "4000.00",
        isActive: true,
      },
      {
        propertyId: property.id,
        code: "CORP",
        name: "Corporate Rate",
        description: "Corporate discount rate",
        baseRate: "4500.00",
        isActive: true,
      },
    ])
    .returning();

  const rateMap = Object.fromEntries(rateData.map((r) => [r.code, r.id]));

  // Companies — before bookings (bookings reference companyData)
  const companyData = await db.insert(profiles).values([
    {
      propertyId: property.id,
      type: "company",
      name: "Baltic Lines LLC",
      shortName: "Baltic Lines",
      taxId: "3906012345",
      registrationNumber: "1123456789012",
      email: "corporate@balticlines.ru",
      phone: "+7 (4012) 55-01-01",
      address: "15 Sovetskaya St, Kaliningrad",
      contactPerson: "Elena Petrova",
      creditLimit: "500000.00",
      paymentTermDays: 30,
    },
    {
      propertyId: property.id,
      type: "company",
      name: "Westfilm Inc.",
      shortName: "Westfilm",
      taxId: "3906098765",
      registrationNumber: "1098765432109",
      email: "travel@zapfilm.ru",
      phone: "+7 (4012) 66-02-02",
      address: "42 Mira Ave, Kaliningrad",
      contactPerson: "Andrey Sidorov",
      creditLimit: "300000.00",
      paymentTermDays: 14,
    },
    {
      propertyId: property.id,
      type: "company",
      name: "Kozlov & Co.",
      shortName: "Kozlov",
      taxId: "3906054321",
      email: "kozlov@mail.ru",
      phone: "+7 (906) 234-56-78",
      paymentTermDays: 0,
    },
  ]).returning();

  const taData = await db.insert(profiles).values([
    {
      propertyId: property.id,
      type: "travel_agent",
      name: "Baltic Travel Agency",
      iataCode: "BT1234",
      commissionPercent: "15.00",
      email: "bookings@baltictravel.ru",
      phone: "+7 (4012) 77-03-03",
      contactPerson: "Maria Ivanova",
    },
    {
      propertyId: property.id,
      type: "travel_agent",
      name: "Ost-Express",
      iataCode: "OE5678",
      commissionPercent: "10.00",
      email: "hotels@ostexpress.de",
      phone: "+49 30 1234567",
      contactPerson: "Müller Hans",
    },
  ]).returning();

  // Bookings — demo data with different statuses
  const today = new Date();
  const bookingData = [
    // Checked out
    {
      guestIdx: 0,
      roomNumber: "301",
      roomType: "STD",
      rateCode: "RACK",
      checkIn: daysAgo(5),
      checkOut: daysAgo(2),
      status: "checked_out",
      adults: 1,
      children: 0,
      rateAmount: "4500.00",
      paymentMethod: "card",
      actualCheckIn: daysAgo(5, 14, 30),
      actualCheckOut: daysAgo(2, 11, 15),
    },
    // Checked out
    {
      guestIdx: 1,
      roomNumber: "302",
      roomType: "SUP",
      rateCode: "PROMO",
      checkIn: daysAgo(7),
      checkOut: daysAgo(4),
      status: "checked_out",
      adults: 2,
      children: 0,
      rateAmount: "4400.00",
      paymentMethod: "cash",
      actualCheckIn: daysAgo(7, 15, 0),
      actualCheckOut: daysAgo(4, 10, 45),
    },
    // Currently checked in (company: Baltic Lines)
    {
      guestIdx: 2,
      roomNumber: "401",
      roomType: "STD",
      rateCode: "RACK",
      checkIn: daysAgo(1),
      checkOut: daysFromNow(2),
      status: "checked_in",
      adults: 1,
      children: 0,
      rateAmount: "4500.00",
      paymentMethod: "card",
      companyIdx: 0,
      actualCheckIn: daysAgo(1, 14, 20),
      actualCheckOut: null,
    },
    // Currently checked in (company: Westfilm)
    {
      guestIdx: 3,
      roomNumber: "601",
      roomType: "PRM",
      rateCode: "CORP",
      checkIn: daysAgo(2),
      checkOut: daysFromNow(1),
      status: "checked_in",
      adults: 2,
      children: 1,
      rateAmount: "5850.00",
      paymentMethod: "card",
      companyIdx: 1,
      actualCheckIn: daysAgo(2, 16, 0),
      actualCheckOut: null,
    },
    // Future reservation (confirmed)
    {
      guestIdx: 4,
      roomNumber: "402",
      roomType: "SUP",
      rateCode: "RACK",
      checkIn: daysFromNow(3),
      checkOut: daysFromNow(6),
      status: "confirmed",
      adults: 2,
      children: 0,
      rateAmount: "5500.00",
      paymentMethod: null,
      actualCheckIn: null,
      actualCheckOut: null,
    },
    // Future reservation (company: Baltic Lines, TA: Baltic Travel)
    {
      guestIdx: 5,
      roomNumber: "701",
      roomType: "JRS",
      rateCode: "PROMO",
      checkIn: daysFromNow(5),
      checkOut: daysFromNow(8),
      status: "confirmed",
      adults: 2,
      children: 2,
      rateAmount: "6800.00",
      paymentMethod: null,
      companyIdx: 0,
      taIdx: 0,
      actualCheckIn: null,
      actualCheckOut: null,
    },
    // Cancelled
    {
      guestIdx: 6,
      roomNumber: null,
      roomType: "STD",
      rateCode: "RACK",
      checkIn: daysAgo(3),
      checkOut: daysAgo(1),
      status: "cancelled",
      adults: 1,
      children: 0,
      rateAmount: "4500.00",
      paymentMethod: null,
      actualCheckIn: null,
      actualCheckOut: null,
    },
    // No show
    {
      guestIdx: 7,
      roomNumber: null,
      roomType: "SUP",
      rateCode: "CORP",
      checkIn: daysAgo(3),
      checkOut: daysAgo(2),
      status: "no_show",
      adults: 1,
      children: 0,
      rateAmount: "4950.00",
      paymentMethod: "card",
      actualCheckIn: null,
      actualCheckOut: null,
    },
    // Arriving today (confirmed)
    {
      guestIdx: 8,
      roomNumber: "303",
      roomType: "STD",
      rateCode: "RACK",
      checkIn: formatDate(today),
      checkOut: daysFromNow(3),
      status: "confirmed",
      adults: 1,
      children: 0,
      rateAmount: "4500.00",
      paymentMethod: null,
      actualCheckIn: null,
      actualCheckOut: null,
    },
    // Departing today (checked in)
    {
      guestIdx: 9,
      roomNumber: "304",
      roomType: "SUP",
      rateCode: "PROMO",
      checkIn: daysAgo(2),
      checkOut: formatDate(today),
      status: "checked_in",
      adults: 2,
      children: 0,
      rateAmount: "4000.00",
      paymentMethod: "cash",
      actualCheckIn: daysAgo(2, 15, 30),
      actualCheckOut: null,
    },
  ];

  let confSeq = 1;
  const bookingIds: string[] = [];
  for (const b of bookingData) {
    const [inserted] = await db.insert(bookings).values({
      propertyId: property.id,
      guestProfileId: insertedGuests[b.guestIdx].id,
      roomId: b.roomNumber ? roomMap[b.roomNumber] : null,
      roomTypeId: typeMap[b.roomType],
      ratePlanId: rateMap[b.rateCode],
      confirmationNumber: `${property.code}-${String(confSeq++).padStart(6, "0")}`,
      checkInDate: b.checkIn,
      checkOutDate: b.checkOut,
      status: b.status,
      adults: b.adults,
      children: b.children,
      rateAmount: b.rateAmount,
      paymentMethod: b.paymentMethod,
      companyProfileId: b.companyIdx !== undefined ? companyData[b.companyIdx].id : null,
      agentProfileId: b.taIdx !== undefined ? taData[b.taIdx].id : null,
      actualCheckIn: b.actualCheckIn ? new Date(b.actualCheckIn) : null,
      actualCheckOut: b.actualCheckOut ? new Date(b.actualCheckOut) : null,
    }).returning({ id: bookings.id });
    bookingIds.push(inserted.id);
  }

  // Generate daily details for each booking
  for (const b of bookingData) {
    const bookingId = bookingIds[bookingData.indexOf(b)];
    const checkIn = new Date(b.checkIn + "T00:00:00");
    const checkOut = new Date(b.checkOut + "T00:00:00");

    const details = [];
    for (let d = new Date(checkIn); d < checkOut; d.setDate(d.getDate() + 1)) {
      details.push({
        bookingId,
        stayDate: formatDate(d),
        roomId: b.roomNumber ? roomMap[b.roomNumber] : null,
        roomTypeId: typeMap[b.roomType],
        ratePlanId: rateMap[b.rateCode] || null,
        rateAmount: b.rateAmount,
        adults: b.adults,
        children: b.children,
      });
    }
    if (details.length > 0) {
      await db.insert(bookingDailyDetails).values(details);
    }
  }

  // Sync room occupancy with checked_in bookings
  for (const b of bookingData) {
    if (b.status === "checked_in" && b.roomNumber) {
      await db
        .update(rooms)
        .set({ occupancyStatus: "occupied" })
        .where(eq(rooms.id, roomMap[b.roomNumber]));
    }
  }

  // Business date — today, open
  const todayStr = formatDate(today);
  await db.insert(businessDates).values({
    propertyId: property.id,
    date: todayStr,
    status: "open",
  });

  // Transaction codes — 12 codes: adjustment codes first, then revenue/payment
  const adjCodes = await db
    .insert(transactionCodes)
    .values([
      {
        propertyId: property.id,
        code: "ADJ_ROOM",
        description: "Room Charge Adjustment",
        groupCode: "ADJUSTMENT",
        transactionType: "charge",
        isManualPostAllowed: true,
        sortOrder: 1,
      },
      {
        propertyId: property.id,
        code: "ADJ_FB",
        description: "F&B Adjustment",
        groupCode: "ADJUSTMENT",
        transactionType: "charge",
        isManualPostAllowed: true,
        sortOrder: 2,
      },
    ])
    .returning();

  const adjMap = Object.fromEntries(adjCodes.map((c) => [c.code, c.id]));

  await db.insert(transactionCodes).values([
    {
      propertyId: property.id,
      code: "ROOM",
      description: "Room Charge",
      groupCode: "ROOM",
      transactionType: "charge",
      isManualPostAllowed: false,
      adjustmentCodeId: adjMap["ADJ_ROOM"],
      sortOrder: 10,
    },
    {
      propertyId: property.id,
      code: "ROOM_TAX",
      description: "Room Tax",
      groupCode: "TAX",
      transactionType: "charge",
      isManualPostAllowed: false,
      sortOrder: 11,
    },
    {
      propertyId: property.id,
      code: "EXTRA_BED",
      description: "Extra Bed Charge",
      groupCode: "ROOM",
      transactionType: "charge",
      isManualPostAllowed: true,
      adjustmentCodeId: adjMap["ADJ_ROOM"],
      sortOrder: 12,
    },
    {
      propertyId: property.id,
      code: "NO_SHOW",
      description: "No-Show Charge",
      groupCode: "ROOM",
      transactionType: "charge",
      isManualPostAllowed: false,
      adjustmentCodeId: adjMap["ADJ_ROOM"],
      sortOrder: 13,
    },
    {
      propertyId: property.id,
      code: "PAY_CASH",
      description: "Cash Payment",
      groupCode: "PAYMENT",
      transactionType: "payment",
      isManualPostAllowed: true,
      sortOrder: 20,
    },
    {
      propertyId: property.id,
      code: "PAY_CARD",
      description: "Credit Card Payment",
      groupCode: "PAYMENT",
      transactionType: "payment",
      isManualPostAllowed: true,
      sortOrder: 21,
    },
    {
      propertyId: property.id,
      code: "PAY_TRANSFER",
      description: "Bank Transfer",
      groupCode: "PAYMENT",
      transactionType: "payment",
      isManualPostAllowed: true,
      sortOrder: 22,
    },
    {
      propertyId: property.id,
      code: "FB_REST",
      description: "Restaurant Charge",
      groupCode: "FB",
      transactionType: "charge",
      isManualPostAllowed: true,
      adjustmentCodeId: adjMap["ADJ_FB"],
      sortOrder: 30,
    },
    {
      propertyId: property.id,
      code: "FB_BAR",
      description: "Bar Charge",
      groupCode: "FB",
      transactionType: "charge",
      isManualPostAllowed: true,
      adjustmentCodeId: adjMap["ADJ_FB"],
      sortOrder: 31,
    },
    {
      propertyId: property.id,
      code: "MINIBAR",
      description: "Minibar Charge",
      groupCode: "FB",
      transactionType: "charge",
      isManualPostAllowed: true,
      adjustmentCodeId: adjMap["ADJ_FB"],
      sortOrder: 32,
    },
    {
      propertyId: property.id,
      code: "BREAKFAST",
      description: "Breakfast",
      groupCode: "FB",
      transactionType: "charge",
      isManualPostAllowed: true,
      adjustmentCodeId: adjMap["ADJ_FB"],
      sortOrder: 33,
    },
    {
      propertyId: property.id,
      code: "PARKING",
      description: "Parking",
      groupCode: "MISC",
      transactionType: "charge",
      isManualPostAllowed: true,
      sortOrder: 34,
    },
  ]);

  // Transaction code map for packages
  const allTxCodes = await db.select().from(transactionCodes).where(eq(transactionCodes.propertyId, property.id));
  const txCodeMap = Object.fromEntries(allTxCodes.map((c) => [c.code, c.id]));

  // Packages
  const pkgData = await db.insert(packages).values([
    {
      propertyId: property.id,
      code: "BKFST",
      name: "Breakfast",
      transactionCodeId: txCodeMap["BREAKFAST"],
      calculationRule: "per_person_per_night",
      amount: "800.00",
      postingRhythm: "every_night",
      isActive: true,
    },
    {
      propertyId: property.id,
      code: "PARK",
      name: "Parking",
      transactionCodeId: txCodeMap["PARKING"],
      calculationRule: "per_night",
      amount: "500.00",
      postingRhythm: "every_night",
      isActive: true,
    },
  ]).returning();

  const pkgMap = Object.fromEntries(pkgData.map((p) => [p.code, p.id]));

  // Link breakfast package to RACK rate plan (included in rate)
  await db.insert(ratePlanPackages).values([
    {
      ratePlanId: rateMap["RACK"],
      packageId: pkgMap["BKFST"],
      includedInRate: true,
    },
    {
      ratePlanId: rateMap["CORP"],
      packageId: pkgMap["BKFST"],
      includedInRate: true,
    },
  ]);

  // Folio windows — Window 1 for all bookings, Window 2 (company) for company bookings
  const folioWindowValues: {
    bookingId: string;
    windowNumber: number;
    label: string;
    profileId: string;
  }[] = [];
  for (let i = 0; i < bookingData.length; i++) {
    const b = bookingData[i];
    const guestProfile = insertedGuests[b.guestIdx];
    folioWindowValues.push({
      bookingId: bookingIds[i],
      windowNumber: 1,
      label: guestProfile.name,
      profileId: guestProfile.id,
    });
    if (b.companyIdx !== undefined) {
      const company = companyData[b.companyIdx];
      folioWindowValues.push({
        bookingId: bookingIds[i],
        windowNumber: 2,
        label: company.name,
        profileId: company.id,
      });
    }
  }
  const insertedWindows = await db.insert(folioWindows).values(folioWindowValues).returning();
  const windowFor = (bIdx: number, wNum: number) =>
    insertedWindows.find(
      (w) => w.bookingId === bookingIds[bIdx] && w.windowNumber === wNum,
    )!;

  const [bizDate] = await db
    .select({ id: businessDates.id })
    .from(businessDates)
    .where(eq(businessDates.propertyId, property.id));

  // Folio transactions — realistic charges and payments
  await db.insert(folioTransactions).values([
    // GBH-000001 (idx 0, checked_out, 3 nights × 4500, breakfast included)
    { propertyId: property.id, bookingId: bookingIds[0], folioWindowId: windowFor(0, 1).id, businessDateId: bizDate.id, transactionCodeId: txCodeMap["ROOM"], debit: "4500.00", credit: "0", description: "Room Charge", isSystemGenerated: false, postedBy: "system" },
    { propertyId: property.id, bookingId: bookingIds[0], folioWindowId: windowFor(0, 1).id, businessDateId: bizDate.id, transactionCodeId: txCodeMap["ROOM"], debit: "4500.00", credit: "0", description: "Room Charge", isSystemGenerated: false, postedBy: "system" },
    { propertyId: property.id, bookingId: bookingIds[0], folioWindowId: windowFor(0, 1).id, businessDateId: bizDate.id, transactionCodeId: txCodeMap["ROOM"], debit: "4500.00", credit: "0", description: "Room Charge", isSystemGenerated: false, postedBy: "system" },
    { propertyId: property.id, bookingId: bookingIds[0], folioWindowId: windowFor(0, 1).id, businessDateId: bizDate.id, transactionCodeId: txCodeMap["BREAKFAST"], debit: "800.00", credit: "0", description: "Breakfast", isSystemGenerated: false, postedBy: "system" },
    { propertyId: property.id, bookingId: bookingIds[0], folioWindowId: windowFor(0, 1).id, businessDateId: bizDate.id, transactionCodeId: txCodeMap["BREAKFAST"], debit: "800.00", credit: "0", description: "Breakfast", isSystemGenerated: false, postedBy: "system" },
    { propertyId: property.id, bookingId: bookingIds[0], folioWindowId: windowFor(0, 1).id, businessDateId: bizDate.id, transactionCodeId: txCodeMap["BREAKFAST"], debit: "800.00", credit: "0", description: "Breakfast", isSystemGenerated: false, postedBy: "system" },
    { propertyId: property.id, bookingId: bookingIds[0], folioWindowId: windowFor(0, 1).id, businessDateId: bizDate.id, transactionCodeId: txCodeMap["PAY_CARD"], debit: "0", credit: "15900.00", description: "Credit Card Payment", isSystemGenerated: false, postedBy: "admin" },

    // GBH-000002 (idx 1, checked_out, 3 nights × 4400)
    { propertyId: property.id, bookingId: bookingIds[1], folioWindowId: windowFor(1, 1).id, businessDateId: bizDate.id, transactionCodeId: txCodeMap["ROOM"], debit: "4400.00", credit: "0", description: "Room Charge", isSystemGenerated: false, postedBy: "system" },
    { propertyId: property.id, bookingId: bookingIds[1], folioWindowId: windowFor(1, 1).id, businessDateId: bizDate.id, transactionCodeId: txCodeMap["ROOM"], debit: "4400.00", credit: "0", description: "Room Charge", isSystemGenerated: false, postedBy: "system" },
    { propertyId: property.id, bookingId: bookingIds[1], folioWindowId: windowFor(1, 1).id, businessDateId: bizDate.id, transactionCodeId: txCodeMap["ROOM"], debit: "4400.00", credit: "0", description: "Room Charge", isSystemGenerated: false, postedBy: "system" },
    { propertyId: property.id, bookingId: bookingIds[1], folioWindowId: windowFor(1, 1).id, businessDateId: bizDate.id, transactionCodeId: txCodeMap["PAY_CASH"], debit: "0", credit: "13200.00", description: "Cash Payment", isSystemGenerated: false, postedBy: "admin" },

    // GBH-000003 (idx 2, checked_in, company, 1 night so far × 4500)
    { propertyId: property.id, bookingId: bookingIds[2], folioWindowId: windowFor(2, 1).id, businessDateId: bizDate.id, transactionCodeId: txCodeMap["ROOM"], debit: "4500.00", credit: "0", description: "Room Charge", isSystemGenerated: false, postedBy: "system" },
    { propertyId: property.id, bookingId: bookingIds[2], folioWindowId: windowFor(2, 1).id, businessDateId: bizDate.id, transactionCodeId: txCodeMap["BREAKFAST"], debit: "800.00", credit: "0", description: "Breakfast", isSystemGenerated: false, postedBy: "system" },

    // GBH-000004 (idx 3, checked_in, company, 2 nights so far × 5850)
    { propertyId: property.id, bookingId: bookingIds[3], folioWindowId: windowFor(3, 1).id, businessDateId: bizDate.id, transactionCodeId: txCodeMap["ROOM"], debit: "5850.00", credit: "0", description: "Room Charge", isSystemGenerated: false, postedBy: "system" },
    { propertyId: property.id, bookingId: bookingIds[3], folioWindowId: windowFor(3, 1).id, businessDateId: bizDate.id, transactionCodeId: txCodeMap["ROOM"], debit: "5850.00", credit: "0", description: "Room Charge", isSystemGenerated: false, postedBy: "system" },
    { propertyId: property.id, bookingId: bookingIds[3], folioWindowId: windowFor(3, 1).id, businessDateId: bizDate.id, transactionCodeId: txCodeMap["BREAKFAST"], debit: "800.00", credit: "0", description: "Breakfast", isSystemGenerated: false, postedBy: "system" },
    { propertyId: property.id, bookingId: bookingIds[3], folioWindowId: windowFor(3, 1).id, businessDateId: bizDate.id, transactionCodeId: txCodeMap["BREAKFAST"], debit: "800.00", credit: "0", description: "Breakfast", isSystemGenerated: false, postedBy: "system" },
    { propertyId: property.id, bookingId: bookingIds[3], folioWindowId: windowFor(3, 1).id, businessDateId: bizDate.id, transactionCodeId: txCodeMap["PAY_CASH"], debit: "0", credit: "10000.00", description: "Cash Payment", isSystemGenerated: false, postedBy: "admin" },

    // GBH-000010 (idx 9, checked_in, departing today, 2 nights × 4000)
    { propertyId: property.id, bookingId: bookingIds[9], folioWindowId: windowFor(9, 1).id, businessDateId: bizDate.id, transactionCodeId: txCodeMap["ROOM"], debit: "4000.00", credit: "0", description: "Room Charge", isSystemGenerated: false, postedBy: "system" },
    { propertyId: property.id, bookingId: bookingIds[9], folioWindowId: windowFor(9, 1).id, businessDateId: bizDate.id, transactionCodeId: txCodeMap["ROOM"], debit: "4000.00", credit: "0", description: "Room Charge", isSystemGenerated: false, postedBy: "system" },
    { propertyId: property.id, bookingId: bookingIds[9], folioWindowId: windowFor(9, 1).id, businessDateId: bizDate.id, transactionCodeId: txCodeMap["PAY_CASH"], debit: "0", credit: "8000.00", description: "Cash Payment", isSystemGenerated: false, postedBy: "admin" },
  ]);

  // Users — default admin
  const adminHash = await bcrypt.hash("admin123", 10);
  await db.insert(users).values([
    {
      username: "admin",
      passwordHash: adminHash,
      role: "admin",
      propertyId: property.id,
    },
    {
      username: "front",
      passwordHash: await bcrypt.hash("front123", 10),
      role: "front_desk",
      propertyId: property.id,
    },
    {
      username: "hk",
      passwordHash: await bcrypt.hash("hk123", 10),
      role: "housekeeping",
      propertyId: property.id,
    },
  ]);

  console.log(
    `Seeded: 1 property, ${types.length} room types, ${roomData.length} rooms, ${profileData.length} profiles, ${rateData.length} rate plans, ${bookingData.length} bookings, 1 business date, 14 transaction codes, ${pkgData.length} packages, ${folioWindowValues.length} folio windows, 25 folio transactions, 3 users`,
  );
  process.exit(0);
}

// Helper functions
function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function daysAgo(days: number, hour?: number, min?: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  if (hour !== undefined) {
    d.setHours(hour, min || 0, 0, 0);
    return d.toISOString();
  }
  return formatDate(d);
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
