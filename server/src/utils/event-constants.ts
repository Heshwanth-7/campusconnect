export const INTERESTS = [
  'robotics', 'coding', 'music', 'dance', 'sports', 'art', 'entrepreneurship',
  'photography', 'drama', 'gaming', 'volunteering', 'literature',
] as const;

export const EVENT_CATEGORIES = ['MUSIC', 'TECH', 'SPORTS', 'CULTURAL', 'WORKSHOP', 'OTHER'] as const;

export const CATEGORY_TO_INTERESTS = {
  MUSIC: ['music'],
  TECH: ['coding', 'robotics', 'gaming'],
  SPORTS: ['sports'],
  CULTURAL: ['dance', 'art', 'drama', 'literature'],
  WORKSHOP: ['entrepreneurship', 'photography', 'coding', 'art'],
  OTHER: ['volunteering'],
} as const satisfies Record<(typeof EVENT_CATEGORIES)[number], readonly (typeof INTERESTS)[number][]>;
