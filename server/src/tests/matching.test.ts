import { describe, expect, test } from 'vitest';
import { scorePair } from '../services/matching.service.ts';

const lost = { category: 'BOTTLE', title: 'Lost blue water bottle', description: 'Steel lid',
  color: 'Blue', location: 'Lab 2', occurredAt: new Date('2026-11-20') } as const;
const found = { ...lost, title: 'Found a blue bottle', description: 'Steel lid', color: 'BLUE' };

describe('item matching', () => {
  test('blue bottles in Lab 2 share four of five text tokens', () => {
    expect(scorePair(lost, found)).toEqual({ score: 94, breakdown: { category: 30, color: 15, text: 24, location: 15, date: 10 } });
  });
  test('different colour, description and location give a low score', () => {
    expect(scorePair(lost, { ...found, color: 'Red', title: 'Flask', description: 'Plastic handle', location: 'Library' }).score).toBe(40);
  });
  test('different categories and dates over 30 days apart are ineligible', () => {
    expect(scorePair(lost, { ...found, category: 'BAG' }).score).toBe(0);
    expect(scorePair(lost, { ...found, occurredAt: new Date('2026-12-21') }).score).toBe(0);
  });
  test('date points fall to zero at seven days or more than one day early', () => {
    for (const [day, points] of [[18, 0], [19, 9], [21, 9], [26, 1], [27, 0]]) {
      expect(scorePair(lost, { ...found, occurredAt: new Date(Date.UTC(2026, 10, day)) }).breakdown.date).toBe(points);
    }
  });
  test('colour aliases match and empty token sets earn no points', () => {
    const plain = { ...lost, color: ' GREY ', title: 'the', description: 'a', location: 'at' };
    expect(scorePair(plain, { ...plain, color: 'Gray' }).breakdown).toMatchObject({ color: 15, location: 0, text: 0 });
  });
});
