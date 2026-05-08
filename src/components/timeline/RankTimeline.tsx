import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { LAZY_RANK_ROOT_MARGIN } from '../../constants';
import { useLazyVisibility } from '../../hooks/useLazyVisibility';
import type { RankTrack } from '../../parseStLog';
import type { WaitArrow } from '../../types';
import {
  getRankEstimatedHeight,
  getRankPlaceholderWidth,
  getTaskElementId,
} from '../../utils/timelineLayout';
import { StreamRow } from './StreamRow';

type RankTimelineProps = {
  rank: RankTrack;
  isCollapsed: boolean;
  onLazyRenderChange: () => void;
  shouldRenderArrows: boolean;
  onToggle: (rankId: number) => void;
};

export function RankTimeline({
  rank,
  isCollapsed,
  onLazyRenderChange,
  shouldRenderArrows,
  onToggle,
}: RankTimelineProps) {
  const [rankTrackRef, isRankVisible] = useLazyVisibility<HTMLElement>(
    LAZY_RANK_ROOT_MARGIN,
  );
  const streamListRef = useRef<HTMLDivElement | null>(null);
  const [arrows, setArrows] = useState<WaitArrow[]>([]);
  const [visibleStreamVersion, setVisibleStreamVersion] = useState(0);
  const rankTaskCount = rank.streams.reduce(
    (sum, stream) => sum + stream.tasks.length,
    0,
  );
  const handleTasksVisible = useCallback(() => {
    setVisibleStreamVersion((current) => current + 1);
    onLazyRenderChange();
  }, [onLazyRenderChange]);

  useLayoutEffect(() => {
    if (isCollapsed || !isRankVisible || !shouldRenderArrows) {
      setArrows([]);
      return;
    }

    const streamList = streamListRef.current;
    if (!streamList) {
      return;
    }

    function measureArrows() {
      if (!streamList) {
        return;
      }

      const containerRect = streamList.getBoundingClientRect();
      const nextArrows: WaitArrow[] = [];

      for (const stream of rank.streams) {
        for (const task of stream.tasks) {
          if (task.nonReachable || !task.waitFromTask) {
            continue;
          }
          if (
            task.waitFromTask.rankId !== undefined &&
            task.waitFromTask.rankId !== rank.rankId
          ) {
            continue;
          }

          const sourceElement = streamList.querySelector<HTMLElement>(
            `[data-task-id="${getTaskElementId(
              task.waitFromTask.queueId,
              task.waitFromTask.taskIndex,
            )}"]`,
          );
          const targetElement = streamList.querySelector<HTMLElement>(
            `[data-task-id="${getTaskElementId(stream.queueId, task.index)}"]`,
          );

          if (!sourceElement || !targetElement) {
            continue;
          }

          const sourceRect = sourceElement.getBoundingClientRect();
          const targetRect = targetElement.getBoundingClientRect();

          nextArrows.push({
            id: `${stream.queueId}:${task.index}`,
            startX: sourceRect.right - containerRect.left,
            startY: sourceRect.top + sourceRect.height / 2 - containerRect.top,
            endX: targetRect.right - containerRect.left,
            endY: targetRect.top + targetRect.height / 2 - containerRect.top,
          });
        }
      }

      setArrows(nextArrows);
    }

    measureArrows();

    const resizeObserver = new ResizeObserver(measureArrows);
    resizeObserver.observe(streamList);
    for (const taskElement of streamList.querySelectorAll('.task-block')) {
      resizeObserver.observe(taskElement);
    }

    window.addEventListener('resize', measureArrows);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', measureArrows);
    };
  }, [isCollapsed, isRankVisible, rank, shouldRenderArrows, visibleStreamVersion]);

  if (!isRankVisible) {
    return (
      <section
        aria-hidden="true"
        className="rank-track rank-track-placeholder"
        ref={rankTrackRef}
        style={{
          height: getRankEstimatedHeight(rank, isCollapsed),
          width: getRankPlaceholderWidth(rank),
        }}
      />
    );
  }

  return (
    <section
      className={`rank-track${isCollapsed ? ' is-collapsed' : ''}`}
      ref={rankTrackRef}
    >
      <button
        className="rank-header"
        onClick={() => onToggle(rank.rankId)}
        type="button"
      >
        <span className="rank-header-content">
          <span className="rank-toggle" aria-hidden="true">
            {isCollapsed ? '+' : '-'}
          </span>
          <span className="rank-title">Rank {rank.rankId}</span>
          <span className="rank-summary">
            {rank.streams.length} streams / {rankTaskCount} tasks
          </span>
        </span>
      </button>

      {!isCollapsed && (
        <div className="stream-list" ref={streamListRef}>
          <svg
            className="wait-arrow-overlay"
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              <marker
                id={`wait-arrow-head-${rank.rankId}`}
                markerHeight="7"
                markerWidth="7"
                orient="auto"
                refX="6"
                refY="3.5"
              >
                <path d="M0,0 L7,3.5 L0,7 Z" />
              </marker>
            </defs>
            {arrows.map((arrow) => (
              <line
                key={arrow.id}
                x1={arrow.startX}
                y1={arrow.startY}
                x2={arrow.endX}
                y2={arrow.endY}
                markerEnd={`url(#wait-arrow-head-${rank.rankId})`}
              />
            ))}
          </svg>

          {rank.streams.map((stream) => (
            <StreamRow
              key={stream.queueId}
              onTasksVisible={handleTasksVisible}
              rankId={rank.rankId}
              stream={stream}
            />
          ))}
        </div>
      )}
    </section>
  );
}
