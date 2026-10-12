const MINUTE = 60_000;

export const DEFAULT_THROTTLER = {
  name: 'default',
  ttl: MINUTE,
  limit: 100,
} as const;

export const RateLimitPreset = {
  LOGIN: { limit: 5, ttl: MINUTE },
  REGISTER: { limit: 3, ttl: MINUTE },
  REFRESH_TOKEN: { limit: 10, ttl: MINUTE },
  LOGOUT: { limit: 10, ttl: MINUTE },
} as const;
