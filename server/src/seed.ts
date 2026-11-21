import argon2 from 'argon2';
import type { Role } from './generated/prisma/client.ts';
import { CATEGORY_TO_INTERESTS } from './utils/event-constants.ts';
import type { EVENT_CATEGORIES } from './utils/event-constants.ts';
import { db } from './utils/prisma.ts';

const people: { role: Role; name: string; email: string }[] = [
  { role: 'ADMIN', name: 'Demo Admin', email: 'demo-admin@campusconnect.example' },
  { role: 'ORGANIZER', name: 'Demo Organizer', email: 'demo-organizer@campusconnect.example' },
  { role: 'STUDENT', name: 'Demo Student', email: 'demo-student@campusconnect.example' },
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
];

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
      const accounts = [];
      for (const person of people) {
        accounts.push(await tx.user.upsert({
          where: { email: person.email },
          create: { ...person, passwordHash, emailVerifiedAt: now },
          update: {},
        }));
      }
      for (const [index, [title, description, category, clubName, venue]] of samples.entries()) {
        const id = `94a0c4b2-4582-44fc-a20d-${String(index + 1).padStart(12, '0')}`;
        const startsAt = new Date(now.getTime() + (index + 1) * 86_400_000);
        await tx.event.upsert({
          where: { id },
          create: {
            id, title, description, category, clubName, venue,
            tags: [...CATEGORY_TO_INTERESTS[category]],
            startsAt, endsAt: new Date(startsAt.getTime() + 7_200_000),
            capacity: 40 + index * 10, status: 'APPROVED', organizerId: accounts[1].id,
          },
          update: {},
        });
      }
    });
    console.log('Demo login emails:');
    for (const { role, email } of people) console.log(`  ${role}: ${email}`);
    console.log('Use the demo password from the README or the DEMO_PASSWORD used on first seed.');
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
