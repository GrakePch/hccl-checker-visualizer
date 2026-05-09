import { useEffect, useMemo } from 'react';
import { LAZY_STREAM_ROOT_MARGIN } from '../../constants';
import { useLazyVisibility } from '../../hooks/useLazyVisibility';
import type { StreamTrack } from '../../parseStLog';
import type { VisibleTaskUnitRange } from '../../types';
import { getVisibleTasks } from '../../utils/taskWindow';
import {
  getStreamPlaceholderWidth,
  getStreamUnits,
} from '../../utils/timelineLayout';
import { TaskBlock } from './TaskBlock';

type StreamRowProps = {
  rankId: number;
  stream: StreamTrack;
  onTasksVisible: () => void;
  visibleTaskUnitRange: VisibleTaskUnitRange;
};

export function StreamRow({
  rankId,
  stream,
  onTasksVisible,
  visibleTaskUnitRange,
}: StreamRowProps) {
  const [streamRowRef, isStreamVisible] = useLazyVisibility<HTMLDivElement>(
    LAZY_STREAM_ROOT_MARGIN,
  );
  const visibleTasks = useMemo(
    () => getVisibleTasks(stream, visibleTaskUnitRange),
    [stream, visibleTaskUnitRange],
  );

  useEffect(() => {
    if (isStreamVisible) {
      onTasksVisible();
    }
  }, [isStreamVisible, onTasksVisible]);

  return (
    <div className="stream-row" ref={streamRowRef}>
      <div className="stream-label">
        <span>Stream {stream.queueId}</span>
        <span>{stream.tasks.length} tasks</span>
      </div>
      {isStreamVisible ? (
        <div
          className="task-strip"
          style={{
            gridTemplateColumns: `repeat(${getStreamUnits(
              stream,
            )}, var(--task-width))`,
          }}
        >
          {visibleTasks.map((task) => (
            <TaskBlock
              key={`${stream.queueId}-${task.index}`}
              queueId={stream.queueId}
              rankId={rankId}
              task={task}
            />
          ))}
        </div>
      ) : (
        <div
          className="task-strip task-strip-placeholder"
          style={{ width: getStreamPlaceholderWidth(stream) }}
        />
      )}
    </div>
  );
}
