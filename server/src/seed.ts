import { scorePair } from './services/matching.service.ts';
import argon2 from 'argon2';
import type { Prisma, Role } from './generated/prisma/client.ts';
import { CATEGORY_TO_INTERESTS } from './utils/event-constants.ts';
import type { EVENT_CATEGORIES } from './utils/event-constants.ts';
import { db } from './utils/prisma.ts';

const people: { role: Role; name: string; email: string }[] = [
  { role: 'ADMIN', name: 'Demo Admin', email: 'demo-admin@campusconnect.example' },
  { role: 'ORGANIZER', name: 'Demo Organizer', email: 'demo-organizer@campusconnect.example' },
  { role: 'STUDENT', name: 'Demo Student', email: 'demo-student@campusconnect.example' },
  ...Array.from({ length: 9 }, (_, i) => ({ role: 'STUDENT' as const, name: `Demo Student ${i + 2}`, email: `demo-student${i + 2}@campusconnect.example` })),
];
const samples: [string, string, (typeof EVENT_CATEGORIES)[number], string, string][] = [
  ['Courtyard Acoustic Night', 'Bring an instrument or listen to student musicians perform.', 'MUSIC', 'Music Society', 'Central Courtyard'],
  ['Build a Line-Following Robot', 'Work in small teams to assemble and test a line-following robot.', 'TECH', 'Robotics Club', 'Engineering Lab'],
  ['Friendly Five-a-Side', 'Join a casual five-a-side football tournament open to all skill levels.', 'SPORTS', 'Sports Council', 'North Field'],
  ['Campus Short Play Festival', 'Watch original short plays written and performed by students.', 'CULTURAL', 'Drama Club', 'Main Auditorium'],
  ['Photography Walk', 'Practise framing and lighting on a guided walk through campus.', 'WORKSHOP', 'Photography Club', 'Library Steps'],
  ['Campus Clean-Up', 'Help clear litter and sort recycling around the campus paths.', 'OTHER', 'Green Campus Club', 'Student Centre'],
  ['Game Jam Kickoff', 'Find a team and prototype a small game over the weekend.', 'TECH', 'Computing Society', 'Innovation Studio'],
  ['Student Band Showcase', 'Hear campus bands play short sets across different genres.', 'MUSIC', 'Music Society', 'Open Air Theatre'],
  ['Design Clinic', 'Review student project designs.', 'WORKSHOP', 'Design Club', 'Studio'],
  ['Library Book Swap', 'Exchange books with other readers.', 'OTHER', 'Book Club', 'Library'],
];

async function seedBottleMatch(tx: Prisma.TransactionClient, students: string[], now: Date) {
  const posts = [];
  for (const [index, type] of (['LOST', 'FOUND'] as const).entries()) {
    const id = `71ef8ca1-fa65-4aa3-9aef-00000000000${index}`;
    const data = { type, category: 'BOTTLE' as const, color: 'blue', title: `${type} blue bottle`,
      description: 'Steel lid', location: 'Lab 2', occurredAt: now, userId: students[index], status: 'OPEN' as const };
    posts.push(await tx.lostFoundPost.upsert({ where: { id }, create: { id, ...data }, update: data }));
  }
  const [lost, found] = posts;
  const pair = { lostPostId: lost.id, foundPostId: found.id };
  // A rehearsal may have paired a sample post with a different student's item.
  const competing = await tx.match.findMany({ where: { status: 'CONFIRMED',
    OR: [{ lostPostId: lost.id }, { foundPostId: found.id }], NOT: pair } });
  if (competing.length) {
    await tx.match.updateMany({ where: { id: { in: competing.map(match => match.id) } }, data: { status: 'DISMISSED' } });
    const partners = competing.flatMap(match => [match.lostPostId, match.foundPostId]);
    await tx.lostFoundPost.updateMany({ where: { id: { in: partners }, status: 'MATCHED' }, data: { status: 'OPEN' } });
  }
  const score = scorePair(lost, found).score;
  await tx.match.upsert({ where: { lostPostId_foundPostId: pair }, create: { ...pair, score },
    update: { score, status: 'SUGGESTED', lostUserConfirmedAt: null, foundUserConfirmedAt: null } });
}

async function seed() {
  const url = process.env.DATABASE_URL && new URL(process.env.DATABASE_URL);
  if (process.env.NODE_ENV === 'production' || !url
    || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || url.pathname !== '/campusconnect') {
    throw new Error('Run the demo seed against the local campusconnect development database.');
  }

  const passwordHash = await argon2.hash(process.env.DEMO_PASSWORD ?? 'CampusDemo123!', { type: argon2.argon2id });
  const now = new Date();
  const client = db();
  try {
    await client.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(143117, 1)`;
      const accounts = [];
      for (const person of people) {
        const data = { ...person, passwordHash, emailVerifiedAt: now, interestsOnboarded: person.email !== 'demo-student10@campusconnect.example',
          blockedAt: null, lockedUntil: null, failedLoginCount: 0 };
        accounts.push(await tx.user.upsert({ where: { email: person.email }, create: data, update: data }));
      }
      const demoUsers = { userId: { in: accounts.map(account => account.id) } };
      await tx.refreshToken.updateMany({ where: { ...demoUsers, revokedAt: null }, data: { revokedAt: now } });
      await tx.passwordResetToken.deleteMany({ where: demoUsers });
      const students = accounts.slice(2).map(user => user.id);
      const eventIds = [];
      for (const [index, [title, description, category, clubName, venue]] of samples.entries()) {
        const id = `94a0c4b2-4582-44fc-a20d-${String(index + 1).padStart(12, '0')}`;
        eventIds.push(id);
        const days = index === 7 ? -2 : index + 1;
        const startsAt = new Date(now.getTime() + days * 86_400_000);
        const status = index === 8 ? 'PENDING' : index === 9 ? 'REJECTED' : 'APPROVED';
        const data = { title, description, category, clubName, venue, tags: Array.from(CATEGORY_TO_INTERESTS[category]),
          startsAt, endsAt: new Date(+startsAt + 7_200_000), organizerId: accounts[1].id, status,
          rejectionReason: index === 9 ? 'Choose an available venue.' : null,
          registrationDeadline: index === 6 ? now : null } as const;
        await tx.event.upsert({ where: { id }, create: { id, ...data, capacity: 40 }, update: data });
        await tx.registration.deleteMany({ where: { eventId: id, userId: { in: students } } });
        const occupied = await tx.registration.count({ where: { eventId: id, status: 'CONFIRMED' } });
        await tx.event.update({ where: { id }, data: { capacity: occupied + (index === 0 ? 2 : 40) } });
      }
      for (const [i, userId] of students.entries()) {
        await tx.registration.create({ data: { userId, eventId: eventIds[0], status: i < 2 ? 'CONFIRMED' : 'WAITLISTED',
          queuedAt: new Date(+now + i) } });
      }
      await tx.registration.create({ data: { userId: students[0], eventId: eventIds[1], status: 'CONFIRMED' } });
      await seedBottleMatch(tx, students, now);
    }, { timeout: 30_000 });
    console.log('Demo login emails:');
    for (const { role, email } of people) console.log(`  ${role}: ${email}`);
    console.log('Use the demo password from the README or the DEMO_PASSWORD supplied for this seed.');
  } finally {
    await client.$disconnect();
  }
}

try {
  await seed();
} catch {
  console.error('Demo seed failed. Check the local DATABASE_URL and run the migrations first.');
  process.exitCode = 1;
}
