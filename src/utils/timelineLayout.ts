import {
  RANK_BORDER_ESTIMATED_HEIGHT,
  RANK_HEADER_ESTIMATED_HEIGHT,
  STREAM_LIST_VERTICAL_PADDING,
  STREAM_ROW_ESTIMATED_HEIGHT,
  STREAM_ROW_GAP,
} from '../constants';
import type { RankTrack, StreamTrack } from '../parseStLog';

export function getStreamUnits(stream: StreamTrack) {
  return stream.tasks.reduce((sum, task) => sum + (task.span ?? 1), 0);
}

export function getTaskElementId(queueId: number, taskIndex: number) {
  return `${queueId}:${taskIndex}`;
}

export function getGlobalTaskElementId(
  rankId: number,
  queueId: number,
  taskIndex: number,
) {
  return `${rankId}:${queueId}:${taskIndex}`;
}

export function getRankEstimatedHeight(rank: RankTrack, isCollapsed: boolean) {
  if (isCollapsed) {
    return RANK_HEADER_ESTIMATED_HEIGHT + RANK_BORDER_ESTIMATED_HEIGHT;
  }

  return (
    RANK_HEADER_ESTIMATED_HEIGHT +
    STREAM_LIST_VERTICAL_PADDING +
    rank.streams.length * STREAM_ROW_ESTIMATED_HEIGHT +
    Math.max(0, rank.streams.length - 1) * STREAM_ROW_GAP +
    RANK_BORDER_ESTIMATED_HEIGHT
  );
}

export function getStreamPlaceholderWidth(stream: StreamTrack) {
  const streamUnits = getStreamUnits(stream);
  const gapWidth = Math.max(0, streamUnits - 1) * 4;

  return `calc(${streamUnits} * var(--task-width) + ${gapWidth + 10}px)`;
}

export function getRankPlaceholderWidth(rank: RankTrack) {
  const maxStreamUnits = rank.streams.reduce(
    (maxUnits, stream) => Math.max(maxUnits, getStreamUnits(stream)),
    0,
  );
  const gapWidth = Math.max(0, maxStreamUnits - 1) * 4;

  return `max(520px, calc(var(--label-width) + ${maxStreamUnits} * var(--task-width) + ${
    gapWidth + 10
  }px))`;
}
