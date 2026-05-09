import type { StreamTrack } from '../parseStLog';
import type { VisibleTaskUnitRange } from '../types';

function findFirstTaskEndingAfter(
  tasks: StreamTrack['tasks'],
  startUnit: number,
) {
  let low = 0;
  let high = tasks.length;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const task = tasks[middle];

    if (task && task.endUnit <= startUnit) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low;
}

function findFirstTaskStartingAtOrAfter(
  tasks: StreamTrack['tasks'],
  endUnit: number,
) {
  let low = 0;
  let high = tasks.length;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const task = tasks[middle];

    if (task && task.startUnit < endUnit) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low;
}

export function getVisibleTasks(
  stream: StreamTrack,
  visibleTaskUnitRange: VisibleTaskUnitRange,
) {
  const startIndex = findFirstTaskEndingAfter(
    stream.tasks,
    visibleTaskUnitRange.startUnit,
  );
  const endIndex = findFirstTaskStartingAtOrAfter(
    stream.tasks,
    visibleTaskUnitRange.endUnit,
  );

  return stream.tasks.slice(startIndex, endIndex);
}
