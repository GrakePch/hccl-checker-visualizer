import type { TestCase } from '../parseStLog';
import type { TestStats } from '../types';

export function getStats(test: TestCase): TestStats {
  return test.ranks.reduce(
    (stats, rank) => {
      const taskCount = rank.streams.reduce(
        (sum, stream) => sum + stream.tasks.length,
        0,
      );

      return {
        rankCount: stats.rankCount + 1,
        streamCount: stats.streamCount + rank.streams.length,
        taskCount: stats.taskCount + taskCount,
      };
    },
    { rankCount: 0, streamCount: 0, taskCount: 0 },
  );
}
