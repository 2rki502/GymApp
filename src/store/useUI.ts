import { create } from 'zustand';
import type { ID, Workout } from '@/domain/types';

/** Ephemeral UI state (not persisted). */
interface UIState {
  sessionOpen: boolean;
  /** Workout just finished → summary sheet */
  summary: Workout | null;
  workoutsTab: 'routines' | 'history' | 'splits';
  progressTab: 'overview' | 'body' | 'strength' | 'photos';
  librarySection: 'gym' | 'home';
  /** Exercise detail opened as a sheet from inside a live session */
  peekExercise: ID | null;
  set: (patch: Partial<Omit<UIState, 'set'>>) => void;
}

export const useUI = create<UIState>((set) => ({
  sessionOpen: true,
  summary: null,
  workoutsTab: 'routines',
  progressTab: 'overview',
  librarySection: 'gym',
  peekExercise: null,
  set: (patch) => set(patch),
}));
