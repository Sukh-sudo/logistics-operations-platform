import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Prisma, PrismaClient } from '@prisma/client';

process.loadEnvFile(new URL('../.env', import.meta.url));

const prisma = new PrismaClient();
const DAY = 86_400_000;
const HOUR = 3_600_000;
const countArg = process.argv.find((value) => value.startsWith('--count='));
const packageCount = Number(countArg?.split('=')[1] ?? 10_000);
const anchorArg = process.argv.find((value) => value.startsWith('--anchor='));
const anchor = anchorArg ? new Date(anchorArg.split('=')[1]) : new Date();
const fromArg = process.argv.find((value) => value.startsWith('--from='));
const toArg = process.argv.find((value) => value.startsWith('--to='));
const expectedArg = process.argv.find((value) => value.startsWith('--expect='));
const expectedRangeArg = process.argv.find((value) => value.startsWith('--expect-range='));
const expectedPendingArg = process.argv.find((value) => value.startsWith('--expect-pending='));
const expectedCirculationArg = process.argv.find((value) => value.startsWith('--expect-circulation='));
const circulationOnly = process.argv.includes('--circulation-only');
const thisWeek = process.argv.includes('--this-week');
const batchSize = 500;

if (!Number.isInteger(packageCount) || packageCount < 100) {
  throw new Error('--count must be an integer of at least 100');
}
if (Number.isNaN(anchor.getTime())) throw new Error('--anchor must be a valid ISO instant');

const databaseUrl = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(databaseUrl.hostname)) {
  throw new Error(`Refusing to seed a non-local database host: ${databaseUrl.hostname}`);
}
if (databaseUrl.pathname.replace(/^\//, '') !== 'logistics_platform') {
  throw new Error(`Refusing to seed unexpected database: ${databaseUrl.pathname}`);
}

const pad = (value, length = 6) => String(value).padStart(length, '0');
const id = (kind, value) => `demo-${kind}-${pad(value)}`;
const atAge = (days, minutes = 0) => new Date(anchor.getTime() - days * DAY - minutes * 60_000);
const chunkedCreate = async (delegate, rows) => {
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    await delegate.createMany({ data: rows.slice(offset, offset + batchSize) });
  }
};

const terminalData = [
  ['YYC', 'Calgary', 'Alberta', 'America/Edmonton'],
  ['YEG', 'Edmonton', 'Alberta', 'America/Edmonton'],
  ['YVR', 'Vancouver', 'British Columbia', 'America/Vancouver'],
  ['YWG', 'Winnipeg', 'Manitoba', 'America/Winnipeg'],
  ['YXE', 'Saskatoon', 'Saskatchewan', 'America/Regina'],
  ['YQR', 'Regina', 'Saskatchewan', 'America/Regina'],
];
const permissions = [
  'package.create', 'package.view', 'package.update', 'package.history',
  'container.create', 'container.load', 'container.unload',
  'trailer.create', 'trailer.load', 'trailer.depart',
  'user.manage', 'role.manage', 'terminal.manage', 'system.admin',
];
const packageTypes = ['MAIL', 'CONVEYABLE', 'NON_CONVEYABLE', 'DANGEROUS_GOODS'];
const packageStatuses = [
  ['RECEIVED', 8], ['SORTED', 8], ['IN_CONTAINER', 12], ['IN_TRAILER', 10],
  ['DEPARTED', 8], ['ARRIVED', 8], ['OUT_FOR_DELIVERY', 10], ['DELIVERED', 25],
  ['ATTEMPTED_DELIVERY', 5], ['DAMAGED', 2], ['MISROUTED', 2], ['RETURNED_TO_TERMINAL', 2],
];
const circulationStatuses = [
  'RECEIVED', 'SORTED', 'IN_CONTAINER', 'IN_TRAILER',
  'DEPARTED', 'ARRIVED', 'OUT_FOR_DELIVERY', 'ATTEMPTED_DELIVERY',
];
const packageEventsFor = {
  RECEIVED: ['PACKAGE_RECEIVED'],
  SORTED: ['PACKAGE_RECEIVED', 'PACKAGE_SORTED'],
  IN_CONTAINER: ['PACKAGE_RECEIVED', 'PACKAGE_SORTED', 'PACKAGE_LOADED_TO_CONTAINER'],
  IN_TRAILER: ['PACKAGE_RECEIVED', 'PACKAGE_SORTED', 'PACKAGE_LOADED_TO_TRAILER'],
  DEPARTED: ['PACKAGE_RECEIVED', 'PACKAGE_SORTED', 'PACKAGE_LOADED_TO_TRAILER', 'PACKAGE_DEPARTED'],
  ARRIVED: ['PACKAGE_RECEIVED', 'PACKAGE_SORTED', 'PACKAGE_LOADED_TO_TRAILER', 'PACKAGE_DEPARTED', 'PACKAGE_ARRIVED'],
  OUT_FOR_DELIVERY: ['PACKAGE_RECEIVED', 'PACKAGE_SORTED', 'PACKAGE_DEPARTED', 'PACKAGE_ARRIVED', 'PACKAGE_OUT_FOR_DELIVERY'],
  DELIVERED: ['PACKAGE_RECEIVED', 'PACKAGE_SORTED', 'PACKAGE_DEPARTED', 'PACKAGE_ARRIVED', 'PACKAGE_OUT_FOR_DELIVERY', 'PACKAGE_DELIVERED'],
  ATTEMPTED_DELIVERY: ['PACKAGE_RECEIVED', 'PACKAGE_SORTED', 'PACKAGE_DEPARTED', 'PACKAGE_ARRIVED', 'PACKAGE_OUT_FOR_DELIVERY', 'PACKAGE_ATTEMPTED_DELIVERY'],
  DAMAGED: ['PACKAGE_RECEIVED', 'PACKAGE_DAMAGED'],
  MISROUTED: ['PACKAGE_RECEIVED', 'PACKAGE_SORTED', 'PACKAGE_MISROUTED'],
  RETURNED_TO_TERMINAL: ['PACKAGE_RECEIVED', 'PACKAGE_DEPARTED', 'PACKAGE_ARRIVED', 'PACKAGE_OUT_FOR_DELIVERY', 'PACKAGE_ATTEMPTED_DELIVERY', 'PACKAGE_RETURNED_TO_TERMINAL'],
};

function packageStatus(index) {
  let bucket = index % 100;
  for (const [status, weight] of packageStatuses) {
    if (bucket < weight) return status;
    bucket -= weight;
  }
  return 'DELIVERED';
}

function generatedPackageStatus(index, localIndex = index) {
  return circulationOnly
    ? circulationStatuses[localIndex % circulationStatuses.length]
    : packageStatus(index);
}

function currentWeekWindow() {
  const to = new Date(anchor);
  const from = new Date(Date.UTC(
    to.getUTCFullYear(),
    to.getUTCMonth(),
    to.getUTCDate(),
  ));
  const daysSinceMonday = (from.getUTCDay() + 6) % 7;
  from.setUTCDate(from.getUTCDate() - daysSinceMonday);
  return { from, to };
}

function packageIdentifier(index) {
  const number = index + 1;
  switch (index % 4) {
    case 0: return `MAIL${pad(number, 6)}`;
    case 1: return `CON${pad(number, 7)}`;
    case 2: return `NCON${pad(number, 6)}`;
    default: return `DG${pad(number, 8)}`;
  }
}

function containerIdentifier(index) {
  const number = 800_000 + index;
  switch (index % 4) {
    case 0: return `MAIL${pad(number, 6)}`;
    case 1: return `CON${pad(number, 7)}`;
    case 2: return `NCON${pad(number, 6)}`;
    default: return `DG${pad(number, 8)}`;
  }
}

const ensureEmpty = async () => {
  const existing = await Promise.all([
    prisma.package.count(), prisma.container.count(), prisma.trailer.count(),
    prisma.terminal.count(), prisma.user.count(), prisma.shipment.count(),
  ]);
  if (existing.some(Boolean)) {
    throw new Error(`Database is not empty (${existing.join(', ')}); reset it before running demo:seed`);
  }
};

async function seed() {
  await ensureEmpty();
  console.log(`Seeding ${packageCount.toLocaleString()} packages into ${databaseUrl.hostname}:${databaseUrl.port}${databaseUrl.pathname}`);

  const terminals = [];
  for (let index = 0; index < terminalData.length; index += 1) {
    const [terminalCode, city, province, timezone] = terminalData[index];
    terminals.push(await prisma.terminal.create({
      data: {
        terminalCode,
        name: `${city}-000`,
        city,
        province,
        country: 'Canada',
        timezone,
        createdAt: atAge(120 - index),
        updatedAt: atAge(index),
      },
    }));
  }
  await prisma.terminalNameSequence.createMany({
    data: terminalData.map(([, city]) => ({ cityKey: city.toLowerCase(), lastNumber: 0 })),
  });

  const roleRows = [
    { id: 'demo-role-admin', name: 'ADMIN', description: 'Full platform administrator', createdAt: atAge(120) },
    { id: 'demo-role-operator', name: 'HANDHELD_OPERATOR', description: 'Terminal handheld operator', createdAt: atAge(120) },
  ];
  const permissionRows = permissions.map((code, index) => ({ id: id('permission', index), code, description: `Allows ${code}`, createdAt: atAge(120) }));
  await prisma.role.createMany({ data: roleRows });
  await prisma.permission.createMany({ data: permissionRows });
  await prisma.rolePermission.createMany({ data: permissionRows.map((permission) => ({ roleId: 'demo-role-admin', permissionId: permission.id, assignedAt: atAge(120) })) });
  await prisma.rolePermission.createMany({ data: permissionRows.filter((item) => !['user.manage', 'role.manage', 'system.admin'].includes(item.code)).map((permission) => ({ roleId: 'demo-role-operator', permissionId: permission.id, assignedAt: atAge(120) })) });

  const adminPassword = process.env.DEMO_ADMIN_PASSWORD ?? 'DemoAdmin!2026';
  const operatorPassword = process.env.DEMO_OPERATOR_PASSWORD ?? 'DemoOperator!2026';
  const [adminHash, operatorHash] = await Promise.all([bcrypt.hash(adminPassword, 10), bcrypt.hash(operatorPassword, 10)]);
  const users = Array.from({ length: 25 }, (_, index) => {
    const isAdmin = index === 0;
    const employeeNumber = isAdmin ? 'ADMIN0001' : `EMP${pad(index, 5)}`;
    const firstName = isAdmin ? 'Demo' : `Operator${pad(index, 2)}`;
    const lastName = isAdmin ? 'Administrator' : terminalData[index % terminals.length][1];
    return {
      id: id('user', index), employeeNumber, email: isAdmin ? 'demo.admin@logistics.local' : `operator${pad(index, 2)}@logistics.local`,
      firstName, lastName, passwordHash: isAdmin ? adminHash : operatorHash,
      primaryTerminalId: terminals[index % terminals.length].id, badgeBarcode: isAdmin ? 'BADGEADMIN01' : `BADGE${pad(index, 6)}`,
      createdAt: atAge(100 - index),
    };
  });
  await prisma.user.createMany({ data: users });
  await prisma.userRole.createMany({ data: users.map((user, index) => ({ userId: user.id, roleId: index === 0 ? 'demo-role-admin' : 'demo-role-operator', assignedAt: user.createdAt })) });
  await prisma.userEvent.createMany({ data: users.map((user, index) => ({ id: id('uev', index), userId: user.id, eventType: 'USER_CREATED', correlationId: `demo-user-${pad(index)}`, createdAt: user.createdAt })) });
  await prisma.userSnapshot.createMany({ data: users.map((user, index) => ({
    id: id('usnap', index), userId: user.id, employeeNumber: user.employeeNumber, email: user.email,
    firstName: user.firstName, lastName: user.lastName, currentStatus: 'ACTIVE', currentTerminalId: user.primaryTerminalId,
    roleNames: [index === 0 ? 'ADMIN' : 'HANDHELD_OPERATOR'], permissions: index === 0 ? permissions : permissions.filter((code) => !['user.manage', 'role.manage', 'system.admin'].includes(code)),
    lastActivityAt: atAge(index % 7), updatedAt: atAge(index % 7),
  })) });

  const routeRows = Array.from({ length: 18 }, (_, index) => {
    const originIndex = index % terminals.length;
    const destinationIndex = (index + 1 + Math.floor(index / terminals.length)) % terminals.length;
    const status = index % 9 === 8 ? 'RETIRED' : index % 9 === 7 ? 'CREATED' : 'ACTIVE';
    return {
      id: id('route', index), routeNumber: `R-${terminals[originIndex].terminalCode}-${terminals[destinationIndex].terminalCode}-${pad(index + 1, 2)}`,
      name: `${terminals[originIndex].city} to ${terminals[destinationIndex].city}`,
      originTerminalId: terminals[originIndex].id, destinationTerminalId: terminals[destinationIndex].id,
      status, estimatedDistance: 220 + index * 17, estimatedDuration: 150 + index * 8,
      createdAt: atAge(110 - index), updatedAt: atAge(index % 20),
    };
  });
  await prisma.route.createMany({ data: routeRows });
  await prisma.routeStop.createMany({ data: routeRows.map((route, index) => ({ id: id('rstop', index), routeId: route.id, terminalId: terminals[(index + 2) % terminals.length].id, sequence: 1, estimatedArrivalOffset: 75, estimatedDepartureOffset: 90 })) });
  await prisma.routeEvent.createMany({ data: routeRows.map((route, index) => ({ id: id('rev', index), routeId: route.id, eventType: route.status === 'ACTIVE' ? 'ROUTE_ACTIVATED' : route.status === 'RETIRED' ? 'ROUTE_RETIRED' : 'ROUTE_CREATED', correlationId: `demo-route-${pad(index)}`, createdAt: route.updatedAt })) });
  await prisma.routeSnapshot.createMany({ data: routeRows.map((route, index) => ({ id: id('rsnap', index), routeId: route.id, currentStatus: route.status, stopCount: 1, currentStops: [{ terminalId: terminals[(index + 2) % terminals.length].id, sequence: 1 }], estimatedDistance: route.estimatedDistance, estimatedDuration: route.estimatedDuration, lastActivityAt: route.updatedAt, updatedAt: route.updatedAt })) });

  const trailerRows = Array.from({ length: 120 }, (_, index) => {
    const status = ['OPEN', 'CLOSED', 'IN_TRANSIT', 'ARRIVED'][Math.floor(index / 30)];
    const terminalId = status === 'IN_TRANSIT' ? null : terminals[index % terminals.length].id;
    return { id: id('trailer', index), trailerBarcode: `TRLR${pad(index + 1, 6)}`, createdAt: atAge(100 - (index % 90)), status, terminalId, updatedAt: atAge(index % 90, index) };
  });
  await prisma.trailer.createMany({ data: trailerRows.map(({ status, terminalId, updatedAt, ...row }) => row) });

  const assignedContainerTrailers = trailerRows.filter((item) => item.status !== 'OPEN');
  const containerRows = Array.from({ length: 500 }, (_, index) => {
    let status = 'OPEN';
    if (index >= 250 && index < 425) status = 'CLOSED';
    else if (index >= 425 && index < 465) status = 'IN_TRANSIT';
    else if (index >= 465) status = 'ARRIVED';
    const assigned = index >= 350 ? assignedContainerTrailers[index % assignedContainerTrailers.length] : null;
    const terminalId = assigned ? assigned.terminalId : terminals[index % terminals.length].id;
    return {
      id: id('container', index), containerBarcode: containerIdentifier(index), packageType: packageTypes[index % 4],
      createdAt: atAge(95 - (index % 80)), status, currentTrailerId: assigned?.id ?? null,
      currentTerminalId: terminalId, packageCount: 0, updatedAt: atAge(index % 90, index),
    };
  });
  await prisma.container.createMany({ data: containerRows.map(({ status, currentTrailerId, currentTerminalId, packageCount: ignored, updatedAt, ...row }) => row) });

  const trucks = Array.from({ length: 120 }, (_, index) => {
    const terminal = terminals[index % terminals.length];
    const purpose = index % 3 === 0 ? 'LAST_MILE' : 'MIDDLE_MILE';
    const prefix = purpose === 'LAST_MILE' ? 'LM' : 'MM';
    const status = ['AVAILABLE', 'ASSIGNED', 'IN_SERVICE', 'MAINTENANCE', 'OUT_OF_SERVICE'][index % 5];
    return { id: id('truck', index), unitNumber: `${prefix}${terminal.terminalCode}${pad(index + 1, 5)}`, purpose, licensePlate: `DEMO-${pad(index + 1, 4)}`, status, terminalId: ['ASSIGNED', 'IN_SERVICE'].includes(status) ? null : terminal.id, year: 2020 + index % 7, make: index % 2 ? 'Freightliner' : 'International', model: index % 2 ? 'Cascadia' : 'MV', createdAt: atAge(100 - index % 90), updatedAt: atAge(index % 45) };
  });
  const drivers = Array.from({ length: 160 }, (_, index) => {
    const status = ['AVAILABLE', 'ASSIGNED', 'ON_TRIP', 'OFF_DUTY'][index % 4];
    return { id: id('driver', index), employeeId: `DRV${pad(index + 1, 6)}`, licenseNumber: `LIC${pad(index + 1, 7)}`, licenseClass: index % 5 === 0 ? 'Class 3' : 'Class 1', status, terminalId: ['ASSIGNED', 'ON_TRIP'].includes(status) ? null : terminals[index % terminals.length].id, createdAt: atAge(100 - index % 90), updatedAt: atAge(index % 45) };
  });
  await prisma.truck.createMany({ data: trucks.map(({ updatedAt, ...row }) => row) });
  await prisma.driver.createMany({ data: drivers.map(({ updatedAt, ...row }) => row) });
  await prisma.fleetEvent.createMany({ data: [...trucks.map((truck, index) => ({ id: id('fte', index), truckId: truck.id, eventType: 'TRUCK_CREATED', correlationId: `demo-truck-${pad(index)}`, createdAt: truck.createdAt })), ...drivers.map((driver, index) => ({ id: id('fde', index), driverId: driver.id, eventType: 'DRIVER_CREATED', correlationId: `demo-driver-${pad(index)}`, createdAt: driver.createdAt }))] });
  await prisma.truckSnapshot.createMany({ data: trucks.map((truck, index) => ({ id: id('tsnap', index), truckId: truck.id, currentStatus: truck.status, currentTerminalId: truck.terminalId, maintenanceStatus: truck.status === 'MAINTENANCE' ? 'Scheduled maintenance' : null, lastActivityAt: truck.updatedAt, updatedAt: truck.updatedAt })) });
  await prisma.driverSnapshot.createMany({ data: drivers.map((driver, index) => ({ id: id('dsnap', index), driverId: driver.id, currentStatus: driver.status, currentTerminalId: driver.terminalId, lastActivityAt: driver.updatedAt, updatedAt: driver.updatedAt })) });

  const directTrailerPool = trailerRows.filter((item) => item.status === 'CLOSED');
  const movingTrailerPool = trailerRows.filter((item) => item.status === 'IN_TRANSIT');
  const arrivedTrailerPool = trailerRows.filter((item) => item.status === 'ARRIVED');
  const unassignedContainers = containerRows.filter((item) => !item.currentTrailerId);
  const assignedContainers = containerRows.filter((item) => item.currentTrailerId);
  const packages = [];
  const packageSnapshots = [];
  const packageEventRows = [];
  const outboxRows = [];
  const packageContainerHistory = [];
  const packageTrailerHistory = [];

  for (let index = 0; index < packageCount; index += 1) {
    const status = packageStatus(index);
    const type = packageTypes[index % 4];
    const origin = terminals[index % terminals.length];
    const destination = terminals[(index + 1 + Math.floor(index / terminals.length) % 5) % terminals.length];
    const sequence = packageEventsFor[status];
    const updatedAt = atAge(index % 90, index % 720);
    const createdAt = new Date(updatedAt.getTime() - (sequence.length - 1) * 6 * HOUR);
    const packageId = id('pkg', index);
    let currentTerminalId = ['RECEIVED', 'SORTED'].includes(status) ? origin.id : ['ARRIVED', 'RETURNED_TO_TERMINAL'].includes(status) ? destination.id : null;
    let currentContainerId = null;
    let currentTrailerId = null;
    let currentRouteId = null;
    let currentTruckId = null;

    if (status === 'IN_CONTAINER') {
      const candidates = unassignedContainers.filter((item) => item.packageType === type && item.currentTerminalId === origin.id);
      const container = candidates[Math.floor(index / 4) % candidates.length];
      currentContainerId = container.id;
      currentTerminalId = container.currentTerminalId;
      container.packageCount += 1;
      packageContainerHistory.push({ id: id('pch', index), packageId, containerId: container.id, loadedAt: updatedAt });
    } else if (status === 'IN_TRAILER' && index % 2 === 0) {
      const candidates = assignedContainers.filter((item) => item.packageType === type && item.currentTerminalId !== null);
      const container = candidates[Math.floor(index / 4) % candidates.length];
      if (container) {
        currentContainerId = container.id;
        currentTerminalId = container.currentTerminalId;
        container.packageCount += 1;
        packageContainerHistory.push({ id: id('pch', index), packageId, containerId: container.id, loadedAt: updatedAt });
      }
    }
    if (status === 'IN_TRAILER' && !currentContainerId) {
      const trailer = directTrailerPool[index % directTrailerPool.length];
      currentTrailerId = trailer.id;
      currentTerminalId = trailer.terminalId;
      packageTrailerHistory.push({ id: id('pth', index), packageId, trailerId: trailer.id, loadedAt: updatedAt });
    } else if (status === 'DEPARTED') {
      const trailer = movingTrailerPool[index % movingTrailerPool.length];
      currentTrailerId = trailer.id;
      packageTrailerHistory.push({ id: id('pth', index), packageId, trailerId: trailer.id, loadedAt: new Date(updatedAt.getTime() - 6 * HOUR) });
    } else if (status === 'ARRIVED') {
      currentTrailerId = arrivedTrailerPool[index % arrivedTrailerPool.length].id;
    } else if (status === 'OUT_FOR_DELIVERY') {
      currentRouteId = routeRows[index % routeRows.length].id;
      currentTruckId = trucks.filter((item) => item.purpose === 'LAST_MILE')[index % 40].id;
    }

    const trackingNumber = packageIdentifier(index);
    packages.push({ id: packageId, trackingNumber, packageType: type, createdAt });
    packageSnapshots.push({ id: packageId, trackingNumber, packageType: type, currentStatus: status, currentTerminalId, currentContainerId, currentTrailerId, currentRouteId, currentTruckId, updatedAt });
    sequence.forEach((eventType, stage) => {
      const eventId = `demo-pev-${pad(index)}-${pad(stage, 2)}`;
      const eventAt = new Date(createdAt.getTime() + stage * 6 * HOUR);
      packageEventRows.push({ id: eventId, packageId, eventType, terminalId: stage === 0 ? origin.id : eventType.includes('ARRIVED') || eventType.includes('DELIVERED') || eventType.includes('RETURNED') ? destination.id : currentTerminalId, correlationId: `demo-package-${pad(index)}`, metadata: { currentStatus: status }, createdAt: eventAt });
      outboxRows.push({ id: `demo-out-${pad(index)}-${pad(stage, 2)}`, packageEventId: eventId, status: 'COMPLETED', attempts: 1, processedAt: eventAt, createdAt: eventAt, updatedAt: eventAt });
    });
  }

  console.log('Writing package aggregates, snapshots, and histories...');
  await chunkedCreate(prisma.package, packages);
  await chunkedCreate(prisma.packageSnapshot, packageSnapshots);
  await chunkedCreate(prisma.packageEvent, packageEventRows);
  await chunkedCreate(prisma.packageProjectionOutbox, outboxRows);
  await chunkedCreate(prisma.packageContainerHistory, packageContainerHistory);
  await chunkedCreate(prisma.packageTrailerHistory, packageTrailerHistory);

  const containerTrailerHistory = containerRows.filter((item) => item.currentTrailerId).map((item, index) => ({ id: id('cth', index), containerId: item.id, trailerId: item.currentTrailerId, loadedAt: item.updatedAt }));
  await prisma.containerSnapshot.createMany({ data: containerRows.map((container) => ({ id: container.id, containerBarcode: container.containerBarcode, packageType: container.packageType, currentStatus: container.status, currentTrailerId: container.currentTrailerId, currentTerminalId: container.currentTerminalId, packageCount: container.packageCount, updatedAt: container.updatedAt })) });
  await prisma.containerEvent.createMany({ data: containerRows.map((container, index) => ({ id: id('cev', index), containerId: container.id, eventType: container.status === 'CLOSED' ? 'CONTAINER_CLOSED' : container.status === 'IN_TRANSIT' ? 'CONTAINER_DEPARTED' : container.status === 'ARRIVED' ? 'CONTAINER_ARRIVED' : 'CONTAINER_CREATED', correlationId: `demo-container-${pad(index)}`, createdAt: container.updatedAt })) });
  await prisma.containerTrailerHistory.createMany({ data: containerTrailerHistory });

  const loosePackagesByTrailer = new Map();
  for (const item of packageSnapshots) if (item.currentTrailerId) loosePackagesByTrailer.set(item.currentTrailerId, (loosePackagesByTrailer.get(item.currentTrailerId) ?? 0) + 1);
  const containersByTrailer = new Map();
  for (const item of containerRows) if (item.currentTrailerId) containersByTrailer.set(item.currentTrailerId, (containersByTrailer.get(item.currentTrailerId) ?? 0) + 1);
  await prisma.trailerSnapshot.createMany({ data: trailerRows.map((trailer) => ({ id: trailer.id, trailerBarcode: trailer.trailerBarcode, currentStatus: trailer.status, containerCount: containersByTrailer.get(trailer.id) ?? 0, packageCount: loosePackagesByTrailer.get(trailer.id) ?? 0, currentTerminalId: trailer.terminalId, updatedAt: trailer.updatedAt })) });
  await prisma.trailerEvent.createMany({ data: trailerRows.map((trailer, index) => ({ id: id('trev', index), trailerId: trailer.id, eventType: trailer.status === 'CLOSED' ? 'TRAILER_CLOSED' : trailer.status === 'IN_TRANSIT' ? 'TRAILER_DEPARTED' : trailer.status === 'ARRIVED' ? 'TRAILER_ARRIVED' : 'TRAILER_CREATED', correlationId: `demo-trailer-${pad(index)}`, createdAt: trailer.updatedAt })) });

  const shipmentRows = [];
  const shipmentMemberships = [];
  const shipmentEvents = [];
  const shipmentSnapshots = [];
  const shipmentCount = Math.ceil(packageCount / 5);
  for (let index = 0; index < shipmentCount; index += 1) {
    const members = packageSnapshots.slice(index * 5, index * 5 + 5);
    const memberPackages = packages.slice(index * 5, index * 5 + 5);
    const origin = terminals[index % terminals.length];
    const destination = terminals[(index + 1 + index % 4) % terminals.length];
    const createdAt = new Date(Math.min(...memberPackages.map((item) => item.createdAt.getTime())));
    const completedAt = new Date(Math.max(...members.map((item) => item.updatedAt.getTime())));
    const transitDays = Math.max(1, Math.ceil((completedAt.getTime() - createdAt.getTime()) / DAY));
    const estimatedDeliveryAt = new Date(createdAt.getTime() + transitDays * DAY);
    const delivered = members.filter((item) => item.currentStatus === 'DELIVERED').length;
    const outForDelivery = members.filter((item) => item.currentStatus === 'OUT_FOR_DELIVERY').length;
    let status = delivered === members.length ? 'COMPLETED' : delivered > 0 ? 'PARTIALLY_DELIVERED' : members.some((item) => ['DEPARTED', 'ARRIVED', 'OUT_FOR_DELIVERY'].includes(item.currentStatus)) ? 'IN_TRANSIT' : 'PACKAGES_ASSIGNED';
    if (index % 40 === 0) status = 'CREATED';
    if (index % 40 === 1) status = 'CANCELLED';
    const shipmentId = id('shipment', index);
    shipmentRows.push({ id: shipmentId, shipmentNumber: `SHIP-${pad(index + 1, 7)}`, referenceNumber: `ORDER-${pad(index + 1, 7)}`, notificationRecipient: `customer${pad(index % 250, 3)}@example.com`, status, originTerminalId: origin.id, destinationTerminalId: destination.id, transitDays, estimatedDeliveryAt, createdAt, updatedAt: status === 'COMPLETED' ? completedAt : createdAt });
    shipmentMemberships.push(...members.map((item) => ({ shipmentId, packageId: item.id, assignedAt: createdAt })));
    const shipmentActivityAt = status === 'COMPLETED' ? completedAt : createdAt;
    shipmentEvents.push({ id: id('shev', index), shipmentId, eventType: status === 'COMPLETED' ? 'SHIPMENT_COMPLETED' : status === 'CANCELLED' ? 'SHIPMENT_CANCELLED' : status === 'IN_TRANSIT' ? 'SHIPMENT_IN_TRANSIT' : 'SHIPMENT_CREATED', correlationId: `demo-shipment-${pad(index)}`, createdAt: shipmentActivityAt });
    shipmentSnapshots.push({ id: id('ssnap', index), shipmentId, currentStatus: status, currentTerminalId: status === 'COMPLETED' ? destination.id : status === 'IN_TRANSIT' ? null : origin.id, packageCount: members.length, deliveredPackages: delivered, outForDeliveryPackages: outForDelivery, remainingPackages: members.length - delivered, progressPercent: members.length ? Math.round(delivered / members.length * 100) : 0, completedAt: status === 'COMPLETED' ? completedAt : null, lastActivityAt: shipmentActivityAt, updatedAt: shipmentActivityAt });
  }
  await chunkedCreate(prisma.shipment, shipmentRows);
  await chunkedCreate(prisma.shipmentPackage, shipmentMemberships);
  await chunkedCreate(prisma.shipmentEvent, shipmentEvents);
  await chunkedCreate(prisma.shipmentSnapshot, shipmentSnapshots);

  const trips = Array.from({ length: 180 }, (_, index) => {
    const route = routeRows[index % routeRows.length];
    const status = ['CREATED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'][index % 4];
    const plannedDeparture = atAge(index % 90, index % 600);
    const plannedArrival = new Date(plannedDeparture.getTime() + route.estimatedDuration * 60_000);
    return { id: id('trip', index), tripNumber: `TRIP-${pad(index + 1, 7)}`, routeId: route.id, status, plannedDeparture, actualDeparture: status === 'CREATED' || status === 'CANCELLED' ? null : new Date(plannedDeparture.getTime() + (index % 5) * 60_000), plannedArrival, actualArrival: status === 'COMPLETED' ? new Date(plannedArrival.getTime() + (index % 7) * 60_000) : null, createdAt: new Date(plannedDeparture.getTime() - 7 * DAY), updatedAt: plannedDeparture };
  });
  await prisma.trip.createMany({ data: trips.map(({ updatedAt, ...row }) => row) });
  await prisma.tripStop.createMany({ data: trips.map((trip, index) => ({ id: id('tstop', index), tripId: trip.id, terminalId: terminals[(index + 2) % terminals.length].id, sequence: 1, plannedArrival: new Date(trip.plannedDeparture.getTime() + 75 * 60_000), actualArrival: ['IN_PROGRESS', 'COMPLETED'].includes(trip.status) ? new Date(trip.plannedDeparture.getTime() + 80 * 60_000) : null, plannedDeparture: new Date(trip.plannedDeparture.getTime() + 90 * 60_000), actualDeparture: trip.status === 'COMPLETED' ? new Date(trip.plannedDeparture.getTime() + 95 * 60_000) : null, status: trip.status === 'COMPLETED' ? 'DEPARTED' : trip.status === 'IN_PROGRESS' ? 'ARRIVED' : 'PENDING', delayMinutes: index % 6 === 0 ? 15 : 0, notes: index % 6 === 0 ? 'Demo weather delay' : null })) });
  await prisma.tripEvent.createMany({ data: trips.map((trip, index) => ({ id: id('tripev', index), tripId: trip.id, eventType: trip.status === 'COMPLETED' ? 'TRIP_COMPLETED' : trip.status === 'CANCELLED' ? 'TRIP_CANCELLED' : trip.status === 'IN_PROGRESS' ? 'TRIP_STARTED' : 'TRIP_CREATED', correlationId: `demo-trip-${pad(index)}`, createdAt: trip.updatedAt })) });
  await prisma.tripSnapshot.createMany({ data: trips.map((trip, index) => ({ id: id('tripsnap', index), tripId: trip.id, currentStatus: trip.status, currentStopId: trip.status === 'IN_PROGRESS' ? id('tstop', index) : null, nextStopId: trip.status === 'CREATED' ? id('tstop', index) : null, currentTerminalId: trip.status === 'IN_PROGRESS' ? terminals[(index + 2) % terminals.length].id : null, completedStops: trip.status === 'COMPLETED' ? 1 : 0, totalStops: 1, progressPercent: trip.status === 'COMPLETED' ? 100 : trip.status === 'IN_PROGRESS' ? 50 : 0, delayMinutes: index % 6 === 0 ? 15 : 0, lastActivityAt: trip.updatedAt, updatedAt: trip.updatedAt })) });

  const assignments = trips.slice(0, 100).map((trip, index) => ({ id: id('assign', index), tripId: trip.id, truckId: trucks[index].id, driverId: drivers[index].id, trailerId: trailerRows[index % trailerRows.length].id, status: ['CREATED', 'IN_PROGRESS'].includes(trip.status) ? 'ACTIVE' : 'RELEASED', assignedAt: new Date(trip.plannedDeparture.getTime() - DAY), releasedAt: ['COMPLETED', 'CANCELLED'].includes(trip.status) ? trip.updatedAt : null }));
  await prisma.equipmentAssignment.createMany({ data: assignments });
  for (const assignment of assignments.filter((item) => item.status === 'ACTIVE')) {
    await prisma.trip.update({ where: { id: assignment.tripId }, data: { equipmentAssignmentId: assignment.id } });
    await prisma.truckSnapshot.update({ where: { truckId: assignment.truckId }, data: { assignedTripId: assignment.tripId } });
    await prisma.driverSnapshot.update({ where: { driverId: assignment.driverId }, data: { assignedTripId: assignment.tripId } });
  }

  const devices = Array.from({ length: 12 }, (_, index) => ({ id: id('device', index), deviceId: `HH-${terminalData[index % terminals.length][0]}-${pad(index + 1, 3)}`, credentialHash: createHash('sha256').update(`demo-device-${index}`).digest('hex'), createdAt: atAge(60 - index), updatedAt: atAge(index % 7) }));
  await prisma.handheldDevice.createMany({ data: devices.map(({ updatedAt, ...row }) => row) });
  await prisma.handheldDeviceEvent.createMany({ data: devices.map((device, index) => ({ id: id('hdev', index), handheldDeviceId: device.id, eventType: 'DEVICE_ENROLLED', correlationId: `demo-device-${pad(index)}`, createdAt: device.createdAt })) });
  await prisma.handheldDeviceSnapshot.createMany({ data: devices.map((device) => ({ id: device.id, deviceId: device.deviceId, displayName: `Demo ${device.deviceId}`, platform: 'SIMULATOR', currentStatus: 'ACTIVE', enrolledAt: device.createdAt, lastActivityAt: device.updatedAt, updatedAt: device.updatedAt })) });

  const sessions = Array.from({ length: 120 }, (_, index) => {
    const active = index < 12;
    const createdAt = active ? new Date(anchor.getTime() - (index + 1) * HOUR / 2) : atAge(index % 30, index % 600);
    const state = active ? 'ACTIVE' : index % 10 === 0 ? 'INACTIVE_OFFLINE' : 'COMPLETED';
    return { id: id('session', index), employeeId: users[1 + index % 24].id, terminalId: terminals[index % terminals.length].id, deviceId: devices[index % devices.length].deviceId, taskType: ['TRAILER_LOAD', 'TRAILER_UNLOAD', 'CONTAINER_LOAD', 'CONTAINER_UNLOAD', 'LAST_MILE_LOADING', 'COURIER_DELIVERY'][index % 6], createdAt, state };
  });
  await prisma.handheldTaskSession.createMany({ data: sessions.map(({ state, ...row }) => row) });
  await prisma.handheldTaskSessionEvent.createMany({ data: sessions.map((session, index) => ({ id: id('hsev', index), taskSessionId: session.id, eventType: 'SESSION_STARTED', correlationId: `demo-session-${pad(index)}`, createdAt: session.createdAt })) });
  await prisma.handheldTaskSessionSnapshot.createMany({ data: sessions.map((session) => ({ id: session.id, currentState: session.state, networkState: session.state === 'INACTIVE_OFFLINE' ? 'OFFLINE_NETWORK' : 'ONLINE', lastAcceptedActivityAt: session.createdAt, updatedAt: session.createdAt })) });
  await prisma.handheldTaskInterval.createMany({ data: sessions.map((session, index) => ({ id: id('hint', index), taskSessionId: session.id, startedAt: session.createdAt, endedAt: session.state === 'ACTIVE' ? null : new Date(session.createdAt.getTime() + (4 + index % 4) * HOUR) })) });

  const handheldActions = ['LOAD_PACKAGE_TO_TRAILER', 'UNLOAD_PACKAGE_FROM_TRAILER', 'LOAD_PACKAGE_TO_CONTAINER', 'UNLOAD_PACKAGE_FROM_CONTAINER', 'LOAD_PACKAGE_TO_ROUTE', 'REMOVE_PACKAGE_FROM_ROUTE', 'PACKAGE_OUT_FOR_DELIVERY', 'PACKAGE_DELIVERED', 'PACKAGE_ATTEMPTED_DELIVERY', 'PACKAGE_DAMAGED', 'PACKAGE_MISROUTED', 'PACKAGE_RETURNED_TO_TERMINAL'];
  const receipts = Array.from({ length: 3_000 }, (_, index) => {
    const session = sessions[index % sessions.length];
    const mod = index % 20;
    const resultStatus = mod === 0 ? 'REJECTED' : mod === 1 ? 'DUPLICATE_ACCEPTED' : mod === 2 ? 'REVERSED' : 'ACCEPTED';
    const serverReceivedAt = new Date(session.createdAt.getTime() + (index % 240) * 60_000);
    return { id: id('receipt', index), clientEventId: `demo-client-${pad(index)}`, taskSessionId: session.id, employeeId: session.employeeId, action: handheldActions[index % handheldActions.length], resultStatus, code: index % 37 === 0 ? 'SYNC_TRANSPORT_FAILURE' : resultStatus === 'REJECTED' ? 'INVALID_SCAN' : 'OK', message: resultStatus === 'REJECTED' ? 'Demo rejected scan' : 'Demo command accepted', deviceId: session.deviceId, deviceTimestamp: new Date(serverReceivedAt.getTime() - (index % 30) * 1000), serverReceivedAt, networkStateAtCapture: index % 11 === 0 ? 'OFFLINE_NETWORK' : 'ONLINE', trackingNumber: packages[index % packages.length].trackingNumber, exceptionFlags: index % 29 === 0 ? ['GPS_MISSING'] : [], originalReceiptId: resultStatus === 'REVERSED' ? id('receipt', index - 1) : null, reversedAt: resultStatus === 'REVERSED' ? serverReceivedAt : null, duplicateCount: resultStatus === 'DUPLICATE_ACCEPTED' ? 2 : 0 };
  });
  await chunkedCreate(prisma.handheldCommandReceipt, receipts);

  const terminalEvents = terminals.map((terminal, index) => ({ id: id('terev', index), terminalId: terminal.id, eventType: 'TERMINAL_CREATED', correlationId: `demo-terminal-${pad(index)}`, payload: { terminalCode: terminal.terminalCode, status: 'OPERATIONAL' }, createdAt: terminal.createdAt }));
  await prisma.terminalEvent.createMany({ data: terminalEvents });
  await prisma.terminalSnapshot.createMany({ data: terminals.map((terminal, index) => ({
    id: id('termsnap', index), terminalId: terminal.id, currentStatus: 'OPERATIONAL',
    packageCount: packageSnapshots.filter((item) => item.currentTerminalId === terminal.id).length,
    containerCount: containerRows.filter((item) => item.currentTerminalId === terminal.id).length,
    trailerCount: trailerRows.filter((item) => item.terminalId === terminal.id).length,
    truckCount: trucks.filter((item) => item.terminalId === terminal.id).length,
    activeTripCount: trips.filter((item) => item.status === 'IN_PROGRESS' && routeRows.find((route) => route.id === item.routeId)?.originTerminalId === terminal.id).length,
    employeeCount: users.filter((item) => item.primaryTerminalId === terminal.id).length,
    lastActivityAt: atAge(index), updatedAt: atAge(index),
  })) });

  console.log(`Seed complete. Demo login: demo.admin@logistics.local / ${adminPassword}`);
}

async function closePendingPackages() {
  const expectedPending = Number(expectedPendingArg?.slice('--expect-pending='.length));
  if (!Number.isInteger(expectedPending) || expectedPending < 1) {
    throw new Error('--close-pending requires --expect-pending with a positive integer');
  }

  const pendingCount = await prisma.packageSnapshot.count({
    where: { currentStatus: { not: 'DELIVERED' } },
  });
  if (pendingCount !== expectedPending) {
    throw new Error(`Refusing reconciliation: expected ${expectedPending.toLocaleString()} pending packages but found ${pendingCount.toLocaleString()}`);
  }

  console.log(`Preparing commitments for ${pendingCount.toLocaleString()} pending packages...`);
  const pending = await prisma.packageSnapshot.findMany({
    where: { currentStatus: { not: 'DELIVERED' } },
    orderBy: { id: 'asc' },
    include: {
      aggregate: {
        select: {
          createdAt: true,
          events: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
          shipmentPackages: {
            select: {
              shipment: {
                select: {
                  id: true,
                  status: true,
                  destinationTerminalId: true,
                  transitDays: true,
                  estimatedDeliveryAt: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const invalidMemberships = pending.filter((item) => item.aggregate.shipmentPackages.length !== 1);
  if (invalidMemberships.length) {
    throw new Error(`Refusing reconciliation: ${invalidMemberships.length.toLocaleString()} pending packages do not belong to exactly one shipment`);
  }

  const allShipments = await prisma.shipment.findMany({
    select: {
      id: true,
      status: true,
      destinationTerminalId: true,
      transitDays: true,
      estimatedDeliveryAt: true,
      createdAt: true,
      packages: {
        select: {
          package: {
            select: {
              events: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
            },
          },
        },
      },
    },
  });
  const commitmentByShipment = new Map(allShipments.map((shipment) => {
    const latestActivity = new Date(Math.max(
      shipment.createdAt.getTime(),
      ...shipment.packages.flatMap((item) => item.package.events.map((event) => event.createdAt.getTime())),
    ));
    if (latestActivity > anchor) {
      throw new Error(`Refusing reconciliation: shipment ${shipment.id} has future package activity at ${latestActivity.toISOString()}`);
    }
    return [shipment.id, { shipment, latestActivity }];
  }));

  const commitments = [];
  for (const { shipment, latestActivity } of commitmentByShipment.values()) {
    if (shipment.estimatedDeliveryAt && shipment.estimatedDeliveryAt < latestActivity) {
      throw new Error(`Refusing reconciliation: shipment ${shipment.id} already has activity after its ${shipment.estimatedDeliveryAt.toISOString()} commitment`);
    }
    const transitDays = shipment.transitDays ?? Math.max(
      1,
      Math.ceil((latestActivity.getTime() - shipment.createdAt.getTime()) / DAY),
    );
    if (transitDays > 365) {
      throw new Error(`Refusing reconciliation: shipment ${shipment.id} needs ${transitDays} transit days, above the 365-day limit`);
    }
    const estimatedDeliveryAt = shipment.estimatedDeliveryAt
      ?? new Date(shipment.createdAt.getTime() + transitDays * DAY);
    commitments.push({ ...shipment, transitDays, estimatedDeliveryAt });
  }

  for (let offset = 0; offset < commitments.length; offset += batchSize) {
    const rows = commitments.slice(offset, offset + batchSize);
    const values = Prisma.join(rows.map((row) => Prisma.sql`(${row.id}, ${row.transitDays}, ${row.estimatedDeliveryAt})`));
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "Shipment" AS shipment
      SET "transitDays" = commitment.transit_days,
          "estimatedDeliveryAt" = commitment.estimated_delivery_at
      FROM (VALUES ${values}) AS commitment(id, transit_days, estimated_delivery_at)
      WHERE shipment.id = commitment.id
    `);
  }

  const commitmentMap = new Map(commitments.map((item) => [item.id, item]));
  const deliveries = pending.map((item) => {
    const shipment = commitmentMap.get(item.aggregate.shipmentPackages[0].shipment.id);
    const latestActivity = item.aggregate.events[0]?.createdAt ?? item.aggregate.createdAt;
    const deliveredAt = new Date(Math.min(anchor.getTime(), shipment.estimatedDeliveryAt.getTime()));
    if (deliveredAt < latestActivity) {
      throw new Error(`Refusing reconciliation: package ${item.trackingNumber} cannot be delivered chronologically within commitment`);
    }
    return {
      packageId: item.id,
      trackingNumber: item.trackingNumber,
      previousStatus: item.currentStatus,
      terminalId: shipment.destinationTerminalId,
      shipmentId: shipment.id,
      deliveredAt,
      eventId: `demo-reconcile-delivered-${item.id}`,
    };
  });

  console.log('Appending delivery events and closing active package relationships...');
  for (let offset = 0; offset < deliveries.length; offset += batchSize) {
    const rows = deliveries.slice(offset, offset + batchSize);
    const snapshotValues = Prisma.join(rows.map((row) => Prisma.sql`(${row.packageId}, ${row.terminalId}, ${row.deliveredAt})`));
    const historyValues = Prisma.join(rows.map((row) => Prisma.sql`(${row.packageId}, ${row.deliveredAt})`));
    await prisma.$transaction([
      prisma.packageEvent.createMany({ data: rows.map((row) => ({
        id: row.eventId,
        packageId: row.packageId,
        eventType: 'PACKAGE_DELIVERED',
        terminalId: row.terminalId,
        correlationId: `demo-reconcile-${row.packageId}`,
        metadata: { previousStatus: row.previousStatus, reconciledWithinCommitment: true },
        createdAt: row.deliveredAt,
      })) }),
      prisma.packageProjectionOutbox.createMany({ data: rows.map((row) => ({
        id: `demo-reconcile-outbox-${row.packageId}`,
        packageEventId: row.eventId,
        status: 'COMPLETED',
        attempts: 1,
        processedAt: row.deliveredAt,
        createdAt: row.deliveredAt,
        updatedAt: row.deliveredAt,
      })) }),
      prisma.$executeRaw(Prisma.sql`
        UPDATE "PackageSnapshot" AS snapshot
        SET "currentStatus" = 'DELIVERED'::"PackageStatus",
            "currentTerminalId" = delivery.terminal_id,
            "currentContainerId" = NULL,
            "currentTrailerId" = NULL,
            "currentRouteId" = NULL,
            "currentTruckId" = NULL,
            "updatedAt" = delivery.delivered_at
        FROM (VALUES ${snapshotValues}) AS delivery(id, terminal_id, delivered_at)
        WHERE snapshot.id = delivery.id
      `),
      prisma.$executeRaw(Prisma.sql`
        UPDATE "PackageContainerHistory" AS history
        SET "unloadedAt" = delivery.delivered_at
        FROM (VALUES ${historyValues}) AS delivery(package_id, delivered_at)
        WHERE history."packageId" = delivery.package_id AND history."unloadedAt" IS NULL
      `),
      prisma.$executeRaw(Prisma.sql`
        UPDATE "PackageTrailerHistory" AS history
        SET "unloadedAt" = delivery.delivered_at
        FROM (VALUES ${historyValues}) AS delivery(package_id, delivered_at)
        WHERE history."packageId" = delivery.package_id AND history."unloadedAt" IS NULL
      `),
    ], { timeout: 120_000 });
  }

  const affectedShipmentIds = [...new Set(deliveries.map((item) => item.shipmentId))];
  const affectedShipments = await prisma.shipment.findMany({
    where: { id: { in: affectedShipmentIds } },
    include: {
      snapshot: true,
      packages: { include: { package: { include: { snapshot: true } } } },
    },
  });
  const shipmentClosures = affectedShipments.map((shipment) => {
    const memberSnapshots = shipment.packages.flatMap((item) => item.package.snapshot ? [item.package.snapshot] : []);
    const completedAt = new Date(Math.max(...memberSnapshots.map((item) => item.updatedAt.getTime())));
    const cancelled = shipment.status === 'CANCELLED';
    return {
      id: shipment.id,
      status: cancelled ? 'CANCELLED' : 'COMPLETED',
      terminalId: cancelled ? shipment.snapshot?.currentTerminalId ?? shipment.destinationTerminalId : shipment.destinationTerminalId,
      packageCount: memberSnapshots.length,
      completedAt: cancelled ? null : completedAt,
      activityAt: completedAt,
      finalPackageEventId: deliveries.filter((item) => item.shipmentId === shipment.id).sort((left, right) => right.deliveredAt - left.deliveredAt)[0]?.eventId,
    };
  });

  console.log(`Closing ${shipmentClosures.filter((item) => item.status === 'COMPLETED').length.toLocaleString()} shipments...`);
  for (let offset = 0; offset < shipmentClosures.length; offset += batchSize) {
    const rows = shipmentClosures.slice(offset, offset + batchSize);
    const shipmentValues = Prisma.join(rows.map((row) => Prisma.sql`(${row.id}, ${row.status}::"ShipmentStatus", ${row.activityAt})`));
    const snapshotValues = Prisma.join(rows.map((row) => Prisma.sql`(${row.id}, ${row.status}::"ShipmentStatus", ${row.terminalId}, ${row.packageCount}, ${row.completedAt}, ${row.activityAt})`));
    const completionEvents = rows.filter((row) => row.status === 'COMPLETED');
    await prisma.$transaction([
      prisma.$executeRaw(Prisma.sql`
        UPDATE "Shipment" AS shipment
        SET status = closure.status, "updatedAt" = closure.activity_at
        FROM (VALUES ${shipmentValues}) AS closure(id, status, activity_at)
        WHERE shipment.id = closure.id
      `),
      prisma.$executeRaw(Prisma.sql`
        UPDATE "ShipmentSnapshot" AS snapshot
        SET "currentStatus" = closure.status,
            "currentTerminalId" = closure.terminal_id,
            "packageCount" = closure.package_count,
            "deliveredPackages" = closure.package_count,
            "outForDeliveryPackages" = 0,
            "remainingPackages" = 0,
            "progressPercent" = 100,
            "completedAt" = closure.completed_at,
            "lastActivityAt" = closure.activity_at,
            "updatedAt" = closure.activity_at
        FROM (VALUES ${snapshotValues}) AS closure(id, status, terminal_id, package_count, completed_at, activity_at)
        WHERE snapshot."shipmentId" = closure.id
      `),
      prisma.shipmentEvent.createMany({ data: completionEvents.map((row) => ({
        id: `demo-reconcile-completed-${row.id}`,
        shipmentId: row.id,
        sourcePackageEventId: row.finalPackageEventId,
        eventType: 'SHIPMENT_COMPLETED',
        correlationId: `demo-reconcile-${row.id}`,
        payload: { reconciledPackageBacklog: true },
        createdAt: row.activityAt,
      })) }),
    ], { timeout: 120_000 });
  }

  const [containerCounts, trailerCounts, terminalCounts] = await Promise.all([
    prisma.packageSnapshot.groupBy({ by: ['currentContainerId'], where: { currentContainerId: { not: null } }, _count: { _all: true } }),
    prisma.packageSnapshot.groupBy({ by: ['currentTrailerId'], where: { currentTrailerId: { not: null } }, _count: { _all: true } }),
    prisma.packageSnapshot.groupBy({ by: ['currentTerminalId'], where: { currentTerminalId: { not: null } }, _count: { _all: true } }),
  ]);
  const containerCountMap = new Map(containerCounts.map((item) => [item.currentContainerId, item._count._all]));
  const trailerCountMap = new Map(trailerCounts.map((item) => [item.currentTrailerId, item._count._all]));
  const terminalCountMap = new Map(terminalCounts.map((item) => [item.currentTerminalId, item._count._all]));
  const [containers, trailers, terminals] = await Promise.all([
    prisma.containerSnapshot.findMany({ select: { id: true } }),
    prisma.trailerSnapshot.findMany({ select: { id: true } }),
    prisma.terminalSnapshot.findMany({ select: { id: true, terminalId: true } }),
  ]);
  for (const container of containers) await prisma.containerSnapshot.update({ where: { id: container.id }, data: { packageCount: containerCountMap.get(container.id) ?? 0 } });
  for (const trailer of trailers) await prisma.trailerSnapshot.update({ where: { id: trailer.id }, data: { packageCount: trailerCountMap.get(trailer.id) ?? 0 } });
  for (const terminal of terminals) await prisma.terminalSnapshot.update({ where: { id: terminal.id }, data: { packageCount: terminalCountMap.get(terminal.terminalId) ?? 0 } });

  const remaining = await prisma.packageSnapshot.count({ where: { currentStatus: { not: 'DELIVERED' } } });
  if (remaining !== 0) throw new Error(`Reconciliation incomplete: ${remaining.toLocaleString()} packages remain pending`);
  console.log(`Reconciliation complete: ${pendingCount.toLocaleString()} packages delivered within commitment; cancelled shipments retained their cancelled status.`);
}

async function summary() {
  const [packages, events, containers, trailers, shipments, trips, receipts] = await Promise.all([
    prisma.package.count(), prisma.packageEvent.count(), prisma.container.count(), prisma.trailer.count(),
    prisma.shipment.count(), prisma.trip.count(), prisma.handheldCommandReceipt.count(),
  ]);
  const byStatus = await prisma.packageSnapshot.groupBy({ by: ['currentStatus'], _count: { _all: true }, orderBy: { currentStatus: 'asc' } });
  const byTerminal = await prisma.packageSnapshot.groupBy({ by: ['currentTerminalId'], _count: { _all: true }, orderBy: { currentTerminalId: 'asc' } });
  const dates = await prisma.packageSnapshot.aggregate({ _min: { updatedAt: true }, _max: { updatedAt: true } });
  console.log(JSON.stringify({ packages, packageEvents: events, containers, trailers, shipments, trips, handheldReceipts: receipts, packageStatuses: byStatus, packageTerminals: byTerminal, snapshotRange: dates }, null, 2));
}

async function appendPackages() {
  if (!thisWeek && (!fromArg || !toArg)) throw new Error('--append requires --from and --to ISO instants, or --this-week');
  const weekWindow = thisWeek ? currentWeekWindow() : null;
  const fromText = fromArg?.slice('--from='.length);
  const toText = toArg?.slice('--to='.length);
  if (!weekWindow && ![fromText, toText].every((value) => /(?:Z|[+-]\d{2}:\d{2})$/i.test(value))) {
    throw new Error('--from and --to must include Z or an explicit UTC offset');
  }
  const from = weekWindow?.from ?? new Date(fromText);
  const to = weekWindow?.to ?? new Date(toText);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
    throw new Error('--from must be earlier than --to');
  }

  const existingCount = await prisma.package.count();
  if (existingCount === 0) throw new Error('Append mode requires an existing demo dataset');
  const existingDemoCount = await prisma.package.count({ where: { id: { startsWith: 'demo-pkg-' } } });
  const expectedLastPackage = await prisma.package.findUnique({ where: { id: id('pkg', existingCount - 1) } });
  if (existingDemoCount !== existingCount || !expectedLastPackage) {
    throw new Error('Append mode requires a contiguous generator-owned package dataset');
  }
  const startIndex = existingCount;
  const [terminals, routeRows, trucks, containerSnapshots, trailerSnapshots] = await Promise.all([
    prisma.terminal.findMany({ orderBy: { id: 'asc' } }),
    prisma.route.findMany({ orderBy: { routeNumber: 'asc' } }),
    prisma.truck.findMany({ orderBy: { unitNumber: 'asc' } }),
    prisma.containerSnapshot.findMany({ orderBy: { containerBarcode: 'asc' } }),
    prisma.trailerSnapshot.findMany({ orderBy: { trailerBarcode: 'asc' } }),
  ]);
  if (terminals.length < 2 || !routeRows.length || !trucks.length || !containerSnapshots.length || !trailerSnapshots.length) {
    throw new Error('Existing demo reference data is incomplete');
  }
  const firstTrackingNumber = packageIdentifier(startIndex);
  const lastTrackingNumber = packageIdentifier(startIndex + packageCount - 1);
  const collision = await prisma.package.findFirst({ where: { trackingNumber: { in: [firstTrackingNumber, lastTrackingNumber] } } });
  if (collision) throw new Error(`Append identifier collision: ${collision.trackingNumber}`);

  const directTrailerPool = trailerSnapshots.filter((item) => item.currentStatus === 'CLOSED');
  const movingTrailerPool = trailerSnapshots.filter((item) => item.currentStatus === 'IN_TRANSIT');
  const arrivedTrailerPool = trailerSnapshots.filter((item) => item.currentStatus === 'ARRIVED');
  const unassignedContainers = containerSnapshots.filter((item) => !item.currentTrailerId);
  const assignedContainers = containerSnapshots.filter((item) => item.currentTrailerId);
  const lastMileTrucks = trucks.filter((item) => item.purpose === 'LAST_MILE');
  const packages = [];
  const packageSnapshots = [];
  const packageEventRows = [];
  const outboxRows = [];
  const packageContainerHistory = [];
  const packageTrailerHistory = [];

  for (let localIndex = 0; localIndex < packageCount; localIndex += 1) {
    const index = startIndex + localIndex;
    const status = generatedPackageStatus(index, localIndex);
    const type = packageTypes[index % 4];
    const origin = terminals[index % terminals.length];
    const destination = terminals[(index + 1 + Math.floor(index / terminals.length) % (terminals.length - 1)) % terminals.length];
    const sequence = packageEventsFor[status];
    const lifecycleDuration = (sequence.length - 1) * 6 * HOUR;
    const availableStartRange = Math.max(0, to.getTime() - lifecycleDuration - from.getTime());
    const ratio = packageCount === 1 ? 0 : localIndex / (packageCount - 1);
    const createdAt = new Date(from.getTime() + Math.floor(availableStartRange * ratio));
    const updatedAt = new Date(createdAt.getTime() + lifecycleDuration);
    const packageId = id('pkg', index);
    let currentTerminalId = ['RECEIVED', 'SORTED'].includes(status) ? origin.id : ['ARRIVED', 'RETURNED_TO_TERMINAL'].includes(status) ? destination.id : null;
    let currentContainerId = null;
    let currentTrailerId = null;
    let currentRouteId = null;
    let currentTruckId = null;

    if (status === 'IN_CONTAINER') {
      const candidates = unassignedContainers.filter((item) => item.packageType === type && item.currentTerminalId === origin.id);
      const container = candidates[Math.floor(index / 4) % candidates.length];
      currentContainerId = container.id;
      currentTerminalId = container.currentTerminalId;
      packageContainerHistory.push({ id: id('pch', index), packageId, containerId: container.id, loadedAt: updatedAt });
    } else if (status === 'IN_TRAILER' && index % 2 === 0) {
      const candidates = assignedContainers.filter((item) => item.packageType === type && item.currentTerminalId !== null);
      const container = candidates[Math.floor(index / 4) % candidates.length];
      if (container) {
        currentContainerId = container.id;
        currentTerminalId = container.currentTerminalId;
        packageContainerHistory.push({ id: id('pch', index), packageId, containerId: container.id, loadedAt: updatedAt });
      }
    }
    if (status === 'IN_TRAILER' && !currentContainerId) {
      const trailer = directTrailerPool[index % directTrailerPool.length];
      currentTrailerId = trailer.id;
      currentTerminalId = trailer.currentTerminalId;
      packageTrailerHistory.push({ id: id('pth', index), packageId, trailerId: trailer.id, loadedAt: updatedAt });
    } else if (status === 'DEPARTED') {
      const trailer = movingTrailerPool[index % movingTrailerPool.length];
      currentTrailerId = trailer.id;
      packageTrailerHistory.push({ id: id('pth', index), packageId, trailerId: trailer.id, loadedAt: new Date(updatedAt.getTime() - 6 * HOUR) });
    } else if (status === 'ARRIVED') {
      currentTrailerId = arrivedTrailerPool[index % arrivedTrailerPool.length].id;
    } else if (status === 'OUT_FOR_DELIVERY') {
      currentRouteId = routeRows[index % routeRows.length].id;
      currentTruckId = lastMileTrucks[index % lastMileTrucks.length].id;
    }

    const trackingNumber = packageIdentifier(index);
    packages.push({ id: packageId, trackingNumber, packageType: type, createdAt });
    packageSnapshots.push({ id: packageId, trackingNumber, packageType: type, currentStatus: status, currentTerminalId, currentContainerId, currentTrailerId, currentRouteId, currentTruckId, updatedAt });
    sequence.forEach((eventType, stage) => {
      const eventId = `demo-pev-${pad(index)}-${pad(stage, 2)}`;
      const eventAt = new Date(createdAt.getTime() + stage * 6 * HOUR);
      packageEventRows.push({ id: eventId, packageId, eventType, terminalId: stage === 0 ? origin.id : eventType.includes('ARRIVED') || eventType.includes('DELIVERED') || eventType.includes('RETURNED') ? destination.id : currentTerminalId, correlationId: `demo-package-${pad(index)}`, metadata: { currentStatus: status }, createdAt: eventAt });
      outboxRows.push({ id: `demo-out-${pad(index)}-${pad(stage, 2)}`, packageEventId: eventId, status: 'COMPLETED', attempts: 1, processedAt: eventAt, createdAt: eventAt, updatedAt: eventAt });
    });
  }

  console.log(`Appending ${packageCount.toLocaleString()} packages (${firstTrackingNumber}..${lastTrackingNumber})`);
  console.log(`Operational window: ${from.toISOString()}..${to.toISOString()}`);
  await chunkedCreate(prisma.package, packages);
  await chunkedCreate(prisma.packageSnapshot, packageSnapshots);
  await chunkedCreate(prisma.packageEvent, packageEventRows);
  await chunkedCreate(prisma.packageProjectionOutbox, outboxRows);
  await chunkedCreate(prisma.packageContainerHistory, packageContainerHistory);
  await chunkedCreate(prisma.packageTrailerHistory, packageTrailerHistory);

  const shipmentRows = [];
  const shipmentMemberships = [];
  const shipmentEvents = [];
  const shipmentSnapshots = [];
  for (let localIndex = 0; localIndex < packageSnapshots.length; localIndex += 5) {
    const members = packageSnapshots.slice(localIndex, localIndex + 5);
    const shipmentIndex = Math.floor((startIndex + localIndex) / 5);
    const origin = terminals[shipmentIndex % terminals.length];
    const destination = terminals[(shipmentIndex + 1 + shipmentIndex % (terminals.length - 1)) % terminals.length];
    const createdAt = packages[localIndex].createdAt;
    const delivered = members.filter((item) => item.currentStatus === 'DELIVERED').length;
    const outForDelivery = members.filter((item) => item.currentStatus === 'OUT_FOR_DELIVERY').length;
    let status = delivered === members.length ? 'COMPLETED' : delivered > 0 ? 'PARTIALLY_DELIVERED' : members.some((item) => ['DEPARTED', 'ARRIVED', 'OUT_FOR_DELIVERY', 'ATTEMPTED_DELIVERY'].includes(item.currentStatus)) ? 'IN_TRANSIT' : 'PACKAGES_ASSIGNED';
    if (!circulationOnly && shipmentIndex % 40 === 0) status = 'CREATED';
    if (!circulationOnly && shipmentIndex % 40 === 1) status = 'CANCELLED';
    const shipmentId = id('shipment', shipmentIndex);
    const latestMemberActivity = Math.max(...members.map((item) => item.updatedAt.getTime()));
    const transitDays = circulationOnly ? 7 : Math.max(1, Math.ceil((latestMemberActivity - createdAt.getTime()) / DAY));
    const estimatedDeliveryAt = new Date(createdAt.getTime() + transitDays * DAY);
    shipmentRows.push({ id: shipmentId, shipmentNumber: `SHIP-${pad(shipmentIndex + 1, 7)}`, referenceNumber: `ORDER-${pad(shipmentIndex + 1, 7)}`, notificationRecipient: `customer${pad(shipmentIndex % 250, 3)}@example.com`, status, originTerminalId: origin.id, destinationTerminalId: destination.id, transitDays, estimatedDeliveryAt, createdAt, updatedAt: createdAt });
    shipmentMemberships.push(...members.map((item) => ({ shipmentId, packageId: item.id, assignedAt: createdAt })));
    shipmentEvents.push({ id: id('shev', shipmentIndex), shipmentId, eventType: status === 'COMPLETED' ? 'SHIPMENT_COMPLETED' : status === 'CANCELLED' ? 'SHIPMENT_CANCELLED' : status === 'IN_TRANSIT' ? 'SHIPMENT_IN_TRANSIT' : 'SHIPMENT_CREATED', correlationId: `demo-shipment-${pad(shipmentIndex)}`, createdAt });
    shipmentSnapshots.push({ id: id('ssnap', shipmentIndex), shipmentId, currentStatus: status, currentTerminalId: status === 'COMPLETED' ? destination.id : status === 'IN_TRANSIT' ? null : origin.id, packageCount: members.length, deliveredPackages: delivered, outForDeliveryPackages: outForDelivery, remainingPackages: members.length - delivered, progressPercent: members.length ? Math.round(delivered / members.length * 100) : 0, completedAt: status === 'COMPLETED' ? createdAt : null, lastActivityAt: createdAt, updatedAt: createdAt });
  }
  await chunkedCreate(prisma.shipment, shipmentRows);
  await chunkedCreate(prisma.shipmentPackage, shipmentMemberships);
  await chunkedCreate(prisma.shipmentEvent, shipmentEvents);
  await chunkedCreate(prisma.shipmentSnapshot, shipmentSnapshots);

  const [containerCounts, looseTrailerCounts, currentTerminalCounts] = await Promise.all([
    prisma.packageSnapshot.groupBy({ by: ['currentContainerId'], where: { currentContainerId: { not: null } }, _count: { _all: true } }),
    prisma.packageSnapshot.groupBy({ by: ['currentTrailerId'], where: { currentTrailerId: { not: null } }, _count: { _all: true } }),
    prisma.packageSnapshot.groupBy({ by: ['currentTerminalId'], where: { currentTerminalId: { not: null } }, _count: { _all: true } }),
  ]);
  const containerCountMap = new Map(containerCounts.map((item) => [item.currentContainerId, item._count._all]));
  const trailerCountMap = new Map(looseTrailerCounts.map((item) => [item.currentTrailerId, item._count._all]));
  const terminalCountMap = new Map(currentTerminalCounts.map((item) => [item.currentTerminalId, item._count._all]));
  for (const container of containerSnapshots) {
    await prisma.containerSnapshot.update({ where: { id: container.id }, data: { packageCount: containerCountMap.get(container.id) ?? 0, updatedAt: container.updatedAt } });
  }
  for (const trailer of trailerSnapshots) {
    await prisma.trailerSnapshot.update({ where: { id: trailer.id }, data: { packageCount: trailerCountMap.get(trailer.id) ?? 0, updatedAt: trailer.updatedAt } });
  }
  const terminalSnapshots = await prisma.terminalSnapshot.findMany();
  for (const terminal of terminalSnapshots) {
    await prisma.terminalSnapshot.update({ where: { id: terminal.id }, data: { packageCount: terminalCountMap.get(terminal.terminalId) ?? 0, updatedAt: terminal.updatedAt } });
  }
  console.log(`Append complete. Total packages: ${(await prisma.package.count()).toLocaleString()}`);
}

async function verify() {
  const [packages, containers, trailers, trucks, terminals, routes, trips, shipments] = await Promise.all([
    prisma.package.findMany({ select: { trackingNumber: true } }),
    prisma.container.findMany({ select: { containerBarcode: true } }),
    prisma.trailer.findMany({ select: { trailerBarcode: true } }),
    prisma.truck.findMany({ select: { unitNumber: true } }),
    prisma.terminal.findMany({ select: { id: true, name: true, terminalCode: true } }),
    prisma.route.findMany({ select: { routeNumber: true } }),
    prisma.trip.findMany({ select: { tripNumber: true } }),
    prisma.shipment.findMany({ select: { shipmentNumber: true } }),
  ]);
  const [snapshots, events, memberships, missingSnapshots, missingEvents, statusGroups, terminalGroups, dates, deliveryCommitmentRows] = await Promise.all([
    prisma.packageSnapshot.count(),
    prisma.packageEvent.count(),
    prisma.shipmentPackage.count(),
    prisma.package.count({ where: { snapshot: null } }),
    prisma.package.count({ where: { events: { none: {} } } }),
    prisma.packageSnapshot.groupBy({ by: ['currentStatus'], _count: { _all: true } }),
    prisma.packageSnapshot.groupBy({ by: ['currentTerminalId'], _count: { _all: true } }),
    prisma.packageSnapshot.aggregate({ _min: { updatedAt: true }, _max: { updatedAt: true } }),
    prisma.$queryRaw(Prisma.sql`
      SELECT COUNT(*)::int AS "lateOrUncommitted"
      FROM "PackageEvent" AS event
      JOIN "ShipmentPackage" AS membership ON membership."packageId" = event."packageId"
      JOIN "Shipment" AS shipment ON shipment.id = membership."shipmentId"
      WHERE event."eventType" = 'PACKAGE_DELIVERED'::"PackageEventType"
        AND (shipment."estimatedDeliveryAt" IS NULL OR event."createdAt" > shipment."estimatedDeliveryAt")
    `),
  ]);
  const expected = expectedArg ? Number(expectedArg.slice('--expect='.length)) : packages.length;
  const verificationWeek = thisWeek ? currentWeekWindow() : null;
  const rangeFrom = verificationWeek?.from ?? (fromArg ? new Date(fromArg.slice('--from='.length)) : undefined);
  const rangeTo = verificationWeek?.to ?? (toArg ? new Date(toArg.slice('--to='.length)) : undefined);
  const rangeCount = rangeFrom && rangeTo
    ? await prisma.packageSnapshot.count({ where: { updatedAt: { gte: rangeFrom, lte: rangeTo } } })
    : undefined;
  const expectedRange = expectedRangeArg ? Number(expectedRangeArg.slice('--expect-range='.length)) : undefined;
  const expectedCirculation = expectedCirculationArg ? Number(expectedCirculationArg.slice('--expect-circulation='.length)) : undefined;
  const circulationCount = rangeFrom && rangeTo && expectedCirculation !== undefined
    ? await prisma.packageSnapshot.count({ where: { currentStatus: { in: circulationStatuses }, updatedAt: { gte: rangeFrom, lte: rangeTo } } })
    : undefined;
  const requiredStatuses = circulationOnly
    ? ['DELIVERED', ...circulationStatuses]
    : packageStatuses.map(([status]) => status);
  const lateOrUncommitted = Number(deliveryCommitmentRows[0]?.lateOrUncommitted ?? 0);
  const checks = [
    ['package count', packages.length === expected, packages.length],
    ['snapshot count', snapshots === packages.length, snapshots],
    ['shipment membership count', memberships === packages.length, memberships],
    ['event history', events >= packages.length, events],
    ['packages missing snapshots', missingSnapshots === 0, missingSnapshots],
    ['packages missing events', missingEvents === 0, missingEvents],
    ['required package statuses', requiredStatuses.every((status) => statusGroups.some((item) => item.currentStatus === status && item._count._all > 0)), statusGroups.length],
    ['delivery commitments', lateOrUncommitted === 0, lateOrUncommitted],
    ['valid package identifiers', packages.every((item) => /^(MAIL\d{6}|CON\d{7}|NCON\d{6}|DG\d{8})$/.test(item.trackingNumber)), packages.length],
    ['valid container identifiers', containers.every((item) => /^(MAIL\d{6}|CON\d{7}|NCON\d{6}|DG\d{8})$/.test(item.containerBarcode)), containers.length],
    ['valid trailer identifiers', trailers.every((item) => /^TRLR\d{6}$/.test(item.trailerBarcode)), trailers.length],
    ['valid truck unit identifiers', trucks.every((item) => /^(LM|MM)[A-Z]{3}\d{5}$/.test(item.unitNumber)), trucks.length],
    ['valid terminal names', terminals.every((item) => /^[A-Za-z ]+-\d{3}$/.test(item.name) && /^[A-Z]{3}$/.test(item.terminalCode)), terminals.length],
    ['valid route numbers', routes.every((item) => /^R-[A-Z]{3}-[A-Z]{3}-\d{2}$/.test(item.routeNumber)), routes.length],
    ['valid trip numbers', trips.every((item) => /^TRIP-\d{7}$/.test(item.tripNumber)), trips.length],
    ['valid shipment numbers', shipments.every((item) => /^SHIP-\d{7}$/.test(item.shipmentNumber)), shipments.length],
    ['terminal references', terminalGroups.every((item) => item.currentTerminalId === null || terminals.some((terminal) => terminal.id === item.currentTerminalId)), terminalGroups.length],
    ['time distribution', dates._min.updatedAt && dates._max.updatedAt && dates._max.updatedAt.getTime() - dates._min.updatedAt.getTime() >= 89 * DAY, `${dates._min.updatedAt?.toISOString()}..${dates._max.updatedAt?.toISOString()}`],
    ...(expectedRange === undefined ? [] : [['requested range count', rangeCount === expectedRange, rangeCount]]),
    ...(expectedCirculation === undefined ? [] : [['requested circulation count', circulationCount === expectedCirculation, circulationCount]]),
  ];
  for (const [name, passed, detail] of checks) console.log(`${passed ? 'PASS' : 'FAIL'} ${name}: ${detail}`);
  const failed = checks.filter(([, passed]) => !passed);
  if (failed.length) throw new Error(`${failed.length} demo-data verification check(s) failed`);
}

try {
  if (process.argv.includes('--close-pending')) await closePendingPackages();
  else if (process.argv.includes('--append')) await appendPackages();
  else if (process.argv.includes('--verify')) await verify();
  else if (process.argv.includes('--summary')) await summary();
  else await seed();
} finally {
  await prisma.$disconnect();
}
