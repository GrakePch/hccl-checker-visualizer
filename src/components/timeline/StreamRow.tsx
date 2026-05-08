import { useEffect } from 'react';
import { LAZY_STREAM_ROOT_MARGIN } from '../../constants';
import { useLazyVisibility } from '../../hooks/useLazyVisibility';
import type { StreamTrack } from '../../parseStLog';
import {
  getStreamPlaceholderWidth,
  getStreamUnits,
} from '../../utils/timelineLayout';
import { TaskBlock } from './TaskBlock';

type StreamRowProps = {
  rankId: number;
  stream: StreamTrack;
  onTasksVisible: () => void;
};

export function StreamRow({ rankId, stream, onTasksVisible }: StreamRowProps) {
  const [streamRowRef, isStreamVisible] = useLazyVisibility<HTMLDivElement>(
    LAZY_STREAM_ROOT_MARGIN,
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
        <span>{stream.tasks.length}</span>
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
          {stream.tasks.map((task) => (
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
