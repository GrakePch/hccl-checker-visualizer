import type { Task } from '../parseStLog';

export function getTaskClassName(taskName: string) {
  const normalizedName = taskName.toLowerCase();

  if (normalizedName.includes('wait')) {
    return 'task-block task-wait';
  }
  if (normalizedName.includes('post')) {
    return 'task-block task-post';
  }
  if (normalizedName.includes('copy')) {
    return 'task-block task-copy';
  }
  if (normalizedName.includes('write')) {
    return 'task-block task-write';
  }
  if (normalizedName.includes('read')) {
    return 'task-block task-read';
  }

  return 'task-block task-default';
}

export function getTaskAbbreviation(taskName: string) {
  const words = taskName.match(/[A-Z]+(?=[A-Z][a-z]|\b)|[A-Z]?[a-z]+|\d+/g);

  if (!words) {
    return taskName.slice(0, 3).toUpperCase();
  }

  return words.map((word) => word[0].toUpperCase()).join('');
}

export function formatAttributes(attributes: Record<string, string>) {
  return Object.entries(attributes)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
}

export function getTaskSubtitle(task: Task) {
  if (task.name === 'LocalPostTo' || task.name === 'LocalWaitFrom') {
    return `topic ${task.attributes.topicId ?? '-'}`;
  }

  if (task.name === 'Post') {
    return `rank ${task.postToTask?.rankId ?? '-'}`;
  }

  if (task.name === 'Wait') {
    return `rank ${task.waitFromTask?.rankId ?? '-'}`;
  }

  return '';
}
