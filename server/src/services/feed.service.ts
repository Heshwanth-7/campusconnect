import type { Event } from '../generated/prisma/client.ts';
import { CATEGORY_TO_INTERESTS } from '../utils/event-constants.ts';
import { db } from '../utils/prisma.ts';

// Tag matches stack. The category, proximity and capacity adjustments each apply once.
const weights = {
  tag: 10, category: 5, soon: 8, full: -4,
  fullBonusDays: 7, zeroBonusDays: 30,
} as const;

type Preferences = { interests: string[] };
type Candidate = Pick<Event, 'tags' | 'category' | 'startsAt'> & { seatsLeft: number };

export function scoreEvent(event: Candidate, user: Preferences, context: { now: Date }) {
  let score = 0;
  const reasons: string[] = [];
  for (const tag of new Set(event.tags)) {
    if (user.interests.includes(tag)) {
      score += weights.tag;
      reasons.push(`Matches your interest: ${tag}`);
    }
  }
  const categoryMatch = CATEGORY_TO_INTERESTS[event.category].find(interest => user.interests.includes(interest));
  if (categoryMatch) {
    score += weights.category;
    reasons.push(`Category relates to ${categoryMatch}`);
  }
  const days = (event.startsAt.getTime() - context.now.getTime()) / 86_400_000;
  if (days >= 0 && days < weights.zeroBonusDays) {
    const fraction = (weights.zeroBonusDays - days) / (weights.zeroBonusDays - weights.fullBonusDays);
    score += weights.soon * Math.min(1, fraction);
    reasons.push(days <= weights.fullBonusDays ? 'Starts within a week' : 'Starts within 30 days');
  }
  if (event.seatsLeft <= 0) {
    score += weights.full;
    reasons.push('Full: join the waitlist');
  }
  return { score, reasons };
}

export async function getFeed(user: Preferences & { id: string }, now = new Date()) {
  const personalised = user.interests.length > 0;
  const rows = await db().event.findMany({
    where: {
      status: 'APPROVED', startsAt: { gte: now },
      registrations: { none: { userId: user.id, status: { in: ['CONFIRMED', 'WAITLISTED'] } } },
    },
    orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    take: personalised ? undefined : 20,
    select: {
      id: true, title: true, clubName: true, venue: true, posterImagePath: true,
      category: true, tags: true, capacity: true, startsAt: true,
      _count: { select: { registrations: { where: { status: 'CONFIRMED' } } } },
    },
  });
  const events = rows.map(({ _count, ...row }) => {
    const event = { ...row, seatsLeft: row.capacity - _count.registrations };
    return { ...event, ...scoreEvent(event, user, { now }) };
  });
  // Stable sort preserves the query's start time and ID order for equal scores.
  if (personalised) events.sort((a, b) => b.score - a.score);
  return events.slice(0, 20);
}
