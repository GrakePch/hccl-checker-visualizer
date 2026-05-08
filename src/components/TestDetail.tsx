import {
  type ChangeEvent,
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ARROW_RENDER_DELAY_MS,
  MAX_TASK_WIDTH,
  MIN_TASK_WIDTH,
  TASK_WIDTH_STEP,
} from '../constants';
import type { TestCase } from '../parseStLog';
import type { WaitArrow } from '../types';
import { clampTaskWidth } from '../utils/taskWidth';
import { getStats } from '../utils/testStats';
import { getGlobalTaskElementId } from '../utils/timelineLayout';
import { RankTimeline } from './timeline/RankTimeline';

type TestDetailProps = {
  onBack: () => void;
  onShowArrowsChange: (showArrows: boolean) => void;
  onTaskWidthChange: (taskWidth: number) => void;
  showArrows: boolean;
  taskWidth: number;
  test: TestCase;
};

export function TestDetail({
  onBack,
  onShowArrowsChange,
  onTaskWidthChange,
  showArrows,
  taskWidth,
  test,
}: TestDetailProps) {
  const timelineContentRef = useRef<HTMLDivElement | null>(null);
  const arrowRenderTimeoutRef = useRef<number | null>(null);
  const [remoteArrows, setRemoteArrows] = useState<WaitArrow[]>([]);
  const [collapsedRanks, setCollapsedRanks] = useState<Set<number>>(
    () => new Set(),
  );
  const [shouldRenderArrows, setShouldRenderArrows] = useState(false);
  const stats = useMemo(() => getStats(test), [test]);

  const clearArrowRenderTimeout = useCallback(() => {
    if (arrowRenderTimeoutRef.current !== null) {
      window.clearTimeout(arrowRenderTimeoutRef.current);
      arrowRenderTimeoutRef.current = null;
    }
  }, []);

  const scheduleArrowRender = useCallback(() => {
    clearArrowRenderTimeout();

    if (!showArrows) {
      setShouldRenderArrows(false);
      return;
    }

    setShouldRenderArrows(false);

    arrowRenderTimeoutRef.current = window.setTimeout(() => {
      setShouldRenderArrows(true);
      arrowRenderTimeoutRef.current = null;
    }, ARROW_RENDER_DELAY_MS);
  }, [clearArrowRenderTimeout, showArrows]);

  useEffect(() => {
    scheduleArrowRender();

    return clearArrowRenderTimeout;
  }, [clearArrowRenderTimeout, scheduleArrowRender, test]);

  useLayoutEffect(() => {
    if (!shouldRenderArrows) {
      setRemoteArrows([]);
      return;
    }

    const timelineContent = timelineContentRef.current;
    if (!timelineContent) {
      return;
    }

    function measureRemoteArrows() {
      if (!timelineContent) {
        return;
      }

      const containerRect = timelineContent.getBoundingClientRect();
      const nextRemoteArrows: WaitArrow[] = [];

      for (const rank of test.ranks) {
        if (collapsedRanks.has(rank.rankId)) {
          continue;
        }

        for (const stream of rank.streams) {
          for (const task of stream.tasks) {
            if (
              task.name !== 'Wait' ||
              task.nonReachable ||
              !task.waitFromTask ||
              task.waitFromTask.rankId === undefined ||
              task.waitFromTask.rankId === rank.rankId ||
              collapsedRanks.has(task.waitFromTask.rankId)
            ) {
              continue;
            }

            const sourceElement = timelineContent.querySelector<HTMLElement>(
              `[data-global-task-id="${getGlobalTaskElementId(
                task.waitFromTask.rankId,
                task.waitFromTask.queueId,
                task.waitFromTask.taskIndex,
              )}"]`,
            );
            const targetElement = timelineContent.querySelector<HTMLElement>(
              `[data-global-task-id="${getGlobalTaskElementId(
                rank.rankId,
                stream.queueId,
                task.index,
              )}"]`,
            );

            if (!sourceElement || !targetElement) {
              continue;
            }

            const sourceRect = sourceElement.getBoundingClientRect();
            const targetRect = targetElement.getBoundingClientRect();

            nextRemoteArrows.push({
              id: `${rank.rankId}:${stream.queueId}:${task.index}`,
              startX: sourceRect.right - containerRect.left,
              startY:
                sourceRect.top + sourceRect.height / 2 - containerRect.top,
              endX: targetRect.right - containerRect.left,
              endY:
                targetRect.top + targetRect.height / 2 - containerRect.top,
            });
          }
        }
      }

      setRemoteArrows(nextRemoteArrows);
    }

    measureRemoteArrows();

    const resizeObserver = new ResizeObserver(measureRemoteArrows);
    resizeObserver.observe(timelineContent);
    for (const taskElement of timelineContent.querySelectorAll('.task-block')) {
      resizeObserver.observe(taskElement);
    }

    window.addEventListener('resize', measureRemoteArrows);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', measureRemoteArrows);
    };
  }, [collapsedRanks, shouldRenderArrows, test]);

  useEffect(() => {
    function isEditableTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      const tagName = target.tagName.toLowerCase();

      return (
        target.isContentEditable ||
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select'
      );
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key !== 'w' && key !== 's') {
        return;
      }

      event.preventDefault();
      scheduleArrowRender();
      const delta = key === 'w' ? TASK_WIDTH_STEP : -TASK_WIDTH_STEP;
      onTaskWidthChange(clampTaskWidth(taskWidth + delta));
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onTaskWidthChange, scheduleArrowRender, taskWidth]);

  function handleTaskWidthChange(event: ChangeEvent<HTMLInputElement>) {
    scheduleArrowRender();
    onTaskWidthChange(clampTaskWidth(event.target.valueAsNumber));
  }

  function handleShowArrowsChange(event: ChangeEvent<HTMLInputElement>) {
    onShowArrowsChange(event.target.checked);
  }

  function toggleRank(rankId: number) {
    setCollapsedRanks((current) => {
      const next = new Set(current);
      if (next.has(rankId)) {
        next.delete(rankId);
      } else {
        next.add(rankId);
      }
      return next;
    });
  }

  return (
    <section
      className="detail-view"
      style={{ '--task-width': `${taskWidth}px` } as CSSProperties}
    >
      <header className="detail-header">
        <button className="back-button" onClick={onBack} type="button">
          Back
        </button>
        <div className="detail-title">
          <h1>{test.testName}</h1>
          <div className="detail-metrics" aria-label="Test summary">
            <span>
              {stats.rankCount} ranks / {stats.streamCount} streams /{' '}
              {stats.taskCount} tasks
            </span>
          </div>
        </div>
        <div className="detail-actions">
          <label className="arrow-toggle">
            <input
              checked={showArrows}
              onChange={handleShowArrowsChange}
              type="checkbox"
            />
            <span>Arrows</span>
          </label>
          <label className="width-slider">
            <span>{taskWidth}px</span>
            <input
              aria-label="Block unit width"
              max={MAX_TASK_WIDTH}
              min={MIN_TASK_WIDTH}
              onChange={handleTaskWidthChange}
              step={TASK_WIDTH_STEP}
              type="range"
              value={taskWidth}
            />
          </label>
        </div>
      </header>

      <div className="timeline-shell" role="region" aria-label={test.testName}>
        <div className="timeline-content" ref={timelineContentRef}>
          <svg
            className="remote-wait-arrow-overlay"
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              <marker
                id="remote-wait-arrow-head"
                markerHeight="8"
                markerWidth="8"
                orient="auto"
                refX="7"
                refY="4"
              >
                <path d="M0,0 L8,4 L0,8 Z" />
              </marker>
            </defs>
            {remoteArrows.map((arrow) => (
              <line
                key={arrow.id}
                x1={arrow.startX}
                y1={arrow.startY}
                x2={arrow.endX}
                y2={arrow.endY}
                markerEnd="url(#remote-wait-arrow-head)"
              />
            ))}
          </svg>

          {test.ranks.map((rank) => (
            <RankTimeline
              isCollapsed={collapsedRanks.has(rank.rankId)}
              key={rank.rankId}
              onLazyRenderChange={scheduleArrowRender}
              onToggle={toggleRank}
              rank={rank}
              shouldRenderArrows={shouldRenderArrows}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
