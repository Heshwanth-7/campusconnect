import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { db } from './utils/prisma.ts';

async function demo() {
  const configured = process.env.DATABASE_URL_TEST;
  const url = configured && new URL(configured);
  if (!url || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || url.pathname !== '/campusconnect_test' || configured === process.env.DATABASE_URL) {
    throw new Error('Use the separate local campusconnect_test database for the demo.');
  }
  url.searchParams.set('connection_limit', '32');
  process.env.DATABASE_URL = url.href;

  const prefix = `no-lock-${randomUUID()}`;
  const client = db();
  const users = { email: { startsWith: prefix } };
  console.log('UNSAFE seat demo. Results vary between runs. This is a demo, not a test.');
  try {
    const people = await client.user.createManyAndReturn({
      data: Array.from({ length: 20 }, (_, index) => ({
        email: `${prefix}-${index}@campusconnect.example`,
        name: `Seat demo ${index + 1}`, passwordHash: 'unused-demo-fixture', emailVerifiedAt: new Date(),
      })),
      select: { id: true },
    });
    const event = await client.event.create({ data: {
      organizerId: people[0].id, title: prefix, description: 'Temporary race demonstration',
      category: 'OTHER', tags: [], venue: 'Demo lab', clubName: 'Demo club', status: 'APPROVED',
      capacity: 1, startsAt: new Date(Date.now() + 86_400_000), endsAt: new Date(Date.now() + 90_000_000),
    } });
    const results = await Promise.allSettled(people.map(async ({ id }) => {
      const confirmed = await client.registration.count({ where: { eventId: event.id, status: 'CONFIRMED' } });
      // Simulate time between checking and writing so it is easy to see the race.
      await setTimeout(30);
      await client.registration.create({ data: {
        eventId: event.id, userId: id, status: confirmed < event.capacity ? 'CONFIRMED' : 'WAITLISTED',
      } });
    }));
    if (results.some(({ status }) => status === 'rejected')) throw new Error('A demo registration failed.');
    const confirmed = await client.registration.count({ where: { eventId: event.id, status: 'CONFIRMED' } });
    console.log(`Capacity: ${event.capacity}. Requests: ${people.length}. Confirmed without the lock: ${confirmed}.`);
  } finally {
    try {
      await client.event.deleteMany({ where: { organizer: users } });
      await client.user.deleteMany({ where: users });
    } finally {
      await client.$disconnect();
    }
  }
}

try {
  await demo();
} catch {
  console.error('Seat demo failed. Check DATABASE_URL_TEST and run npm test to apply the migrations.');
  process.exitCode = 1;
}
