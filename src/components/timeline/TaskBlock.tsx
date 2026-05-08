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
  const subtitle = getTaskSubtitle(task);

  return (
    <div
      className={getTaskClassName(task.name)}
      data-global-task-id={getGlobalTaskElementId(rankId, queueId, task.index)}
      data-task-id={getTaskElementId(queueId, task.index)}
      style={{ gridColumn: `span ${task.span ?? 1}` }}
      title={`#${task.index} ${task.name}\n${formatAttributes(
        task.attributes,
      )}`}
    >
      <span className="task-badge">{task.index}</span>
      <span className="task-name" aria-label={task.name}>
        <span className="task-name-full" aria-hidden="true">
          {task.name}
        </span>
        <span className="task-name-short" aria-hidden="true">
          {taskAbbreviation}
        </span>
      </span>
      {subtitle && <span className="task-meta">{subtitle}</span>}
    </div>
  );
}
