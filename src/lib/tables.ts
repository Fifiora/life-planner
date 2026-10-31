/** Every list the app stores; each is one JSON file at data/<name>.json in the data repo. */
export const TABLES = [
  'members',
  'routines',
  'routine_logs',
  'night_options',
  'night_votes',
  'turns',
  'milestones',
  'trivia_topics',
  'trivia_questions',
  'trivia_attempts',
  'places',
  'trip_plans',
  'income',
  'bills',
  'settings',
] as const
