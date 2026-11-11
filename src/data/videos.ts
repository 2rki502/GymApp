import type { ExerciseVideo } from '@/domain/types';

/** Prototype: real demo videos replacing the stick figure, per exercise id. Credit is required. */
export const EXERCISE_VIDEOS: Record<string, ExerciseVideo> = {
  deadlift: {
    src: 'https://ymove.app/api/free/b59952ca-1551-4c07-835d-ab78bfe9953c',
    poster: 'https://ymove.app/api/free/b59952ca-1551-4c07-835d-ab78bfe9953c?type=thumbnail',
    credit: 'Your Move',
    creditUrl: 'https://ymove.app/exercise-api',
  },
};
