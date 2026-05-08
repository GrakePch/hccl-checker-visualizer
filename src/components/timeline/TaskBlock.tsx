import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { Task } from '../../parseStLog';
import {
  formatAttributes,
  getTaskAbbreviation,
  getTaskClassName,
  getTaskSubtitle,
} from '../../utils/taskDisplay';
import {
  getGlobalTaskElementId,
  getTaskElementId,
} from '../../utils/timelineLayout';

type TaskBlockProps = {
  rankId: number;
  queueId: number;
  task: Task;
};

export function TaskBlock({ rankId, queueId, task }: TaskBlockProps) {
  const taskAbbreviation = getTaskAbbreviation(task.name);
  const taskTitle = task.stuck ? `${task.name} ⚠️Stuck` : task.name;
  const taskShortTitle = task.stuck ? `${taskAbbreviation} ⚠️Stuck` : taskAbbreviation;
  const subtitle = getTaskSubtitle(task);
  const taskNameRef = useRef<HTMLSpanElement | null>(null);
  const taskNameMeasureRef = useRef<HTMLSpanElement | null>(null);
  const [isNameAbbreviated, setIsNameAbbreviated] = useState(false);

  const measureNameOverflow = useCallback(() => {
    const taskNameElement = taskNameRef.current;
    const measureElement = taskNameMeasureRef.current;
    if (!taskNameElement || !measureElement) {
      return;
    }

    const availableWidth = taskNameElement.clientWidth;
    const fullNameWidth = measureElement.scrollWidth;
    const shouldAbbreviate =
      taskShortTitle !== taskTitle && fullNameWidth > availableWidth + 1;

    setIsNameAbbreviated((current) =>
      current === shouldAbbreviate ? current : shouldAbbreviate,
    );
  }, [taskShortTitle, taskTitle]);

  useLayoutEffect(() => {
    let frameId: number | null = null;

    function scheduleMeasure() {
      if (frameId !== null) {
        return;
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        measureNameOverflow();
      });
    }

    measureNameOverflow();

    const taskNameElement = taskNameRef.current;
    const resizeObserver = new ResizeObserver(scheduleMeasure);
    if (taskNameElement) {
      resizeObserver.observe(taskNameElement);
    }
    window.addEventListener('resize', scheduleMeasure);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [measureNameOverflow]);

  return (
    <div
      className={getTaskClassName(task)}
      data-global-task-id={getGlobalTaskElementId(rankId, queueId, task.index)}
      data-task-id={getTaskElementId(queueId, task.index)}
      style={{ gridColumn: `span ${task.span ?? 1}` }}
      title={`#${task.index} ${taskTitle}\n${formatAttributes(
        task.attributes,
      )}`}
    >
      <span className="task-badge">{task.index}</span>
      <span
        className={`task-name${isNameAbbreviated ? ' is-abbreviated' : ''}`}
        ref={taskNameRef}
        aria-label={taskTitle}
      >
        <span className="task-name-full" aria-hidden={isNameAbbreviated}>
          {taskTitle}
        </span>
        <span className="task-name-short" aria-hidden={!isNameAbbreviated}>
          {taskShortTitle}
        </span>
        <span
          className="task-name-measure"
          ref={taskNameMeasureRef}
          aria-hidden="true"
        >
          {taskTitle}
        </span>
      </span>
      {subtitle && <span className="task-meta">{subtitle}</span>}
    </div>
  );
}
