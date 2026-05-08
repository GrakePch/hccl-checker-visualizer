import { DEFAULT_TASK_WIDTH, MAX_TASK_WIDTH, MIN_TASK_WIDTH } from '../constants';

export function clampTaskWidth(width: number) {
  return Math.min(MAX_TASK_WIDTH, Math.max(MIN_TASK_WIDTH, width));
}

export function getSafeTaskWidth(value: string | null) {
  if (value === null) {
    return DEFAULT_TASK_WIDTH;
  }

  const width = Number(value);
  if (!Number.isFinite(width)) {
    return DEFAULT_TASK_WIDTH;
  }

  return clampTaskWidth(width);
}
