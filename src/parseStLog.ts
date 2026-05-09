export type Task = {
  index: number;
  name: string;
  attributes: Record<string, string>;
  span?: number;
  nonReachable?: boolean;
  stuck?: boolean;
  waitFromTask?: {
    queueId: number;
    rankId?: number;
    taskIndex: number;
  };
  postToTask?: {
    queueId: number;
    rankId: number;
    taskIndex: number;
  };
};

export type StreamTrack = {
  queueId: number;
  tasks: Task[];
};

export type RankTrack = {
  rankId: number;
  streams: StreamTrack[];
};

export type TestCase = {
  testName: string;
  ranks: RankTrack[];
};

type MutableStreamTrack = StreamTrack;

type MutableRankTrack = RankTrack & {
  streamMap: Map<number, MutableStreamTrack>;
};

type ParseGroup = {
  testName: string;
  ranks: MutableRankTrack[];
  rankMap: Map<number, MutableRankTrack>;
  taskCount: number;
};

type StreamState = {
  pointer: number;
  rank: MutableRankTrack;
  startTime: number;
  stream: MutableStreamTrack;
};

type AvailablePost = {
  queueId: number;
  rankId: number;
  task: Task;
  taskIndex: number;
};

const rankHeaderPattern = /^rank id is (\d+)$/;
const runPattern = /^\[\s*RUN\s+\] (.+)$/;
const resultPattern = /^\[\s+(?:OK|FAILED)\s+\] ([^\s]+) \(\d+ ms\)$/;
const taskPattern =
  /^\[rankId:(\d+), queueId:(\d+), index:(\d+)\]\s+([A-Za-z_][A-Za-z0-9_]*)\[(.*)\]$/;

function createGroup(testName: string): ParseGroup {
  return {
    testName,
    ranks: [],
    rankMap: new Map(),
    taskCount: 0,
  };
}

function getRank(group: ParseGroup, rankId: number) {
  let rank = group.rankMap.get(rankId);
  if (!rank) {
    rank = {
      rankId,
      streams: [],
      streamMap: new Map(),
    };
    group.rankMap.set(rankId, rank);
    group.ranks.push(rank);
  }
  return rank;
}

function getStream(rank: MutableRankTrack, queueId: number) {
  let stream = rank.streamMap.get(queueId);
  if (!stream) {
    stream = {
      queueId,
      tasks: [],
    };
    rank.streamMap.set(queueId, stream);
    rank.streams.push(stream);
  }
  return stream;
}

function splitTopLevelAttributes(source: string) {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '[') {
      depth += 1;
    } else if (char === ']') {
      depth = Math.max(0, depth - 1);
    } else if (char === ',' && depth === 0) {
      parts.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }

  const tail = source.slice(start).trim();
  if (tail.length > 0) {
    parts.push(tail);
  }

  return parts;
}

function parseAttributes(source: string) {
  const attributes: Record<string, string> = {};

  for (const part of splitTopLevelAttributes(source)) {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex === -1) {
      attributes[part.trim()] = '';
      continue;
    }

    const key = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    if (key.length > 0) {
      attributes[key] = value;
    }
  }

  return attributes;
}

function getLocalPostKey(rankId: number, topicId: string) {
  return `${rankId}:${topicId}`;
}

function getRemoteNotifyKey(sourceRankId: number, targetRankId: number, task: Task) {
  return [
    sourceRankId,
    targetRankId,
    task.attributes.link ?? '',
    task.attributes.notifyType ?? '',
  ].join('|');
}

function getAvailableLocalPost(
  availablePostsByTopic: Map<string, AvailablePost[]>,
  rankId: number,
  topicId: string,
  waitQueueId: number,
) {
  const localPostKey = getLocalPostKey(rankId, topicId);
  const posts = availablePostsByTopic.get(localPostKey) ?? [];
  const postIndex = posts.findIndex((post) => post.queueId !== waitQueueId);

  if (postIndex === -1) {
    return null;
  }

  const [post] = posts.splice(postIndex, 1);
  return post ?? null;
}

function addAvailableLocalPost(
  availablePostsByTopic: Map<string, AvailablePost[]>,
  task: Task,
  rankId: number,
  queueId: number,
) {
  const topicId = task.attributes.topicId;
  if (topicId === undefined) {
    return;
  }

  const localPostKey = getLocalPostKey(rankId, topicId);
  const posts = availablePostsByTopic.get(localPostKey) ?? [];
  posts.push({
    queueId,
    rankId,
    task,
    taskIndex: task.index,
  });
  availablePostsByTopic.set(localPostKey, posts);
}

function getAvailableRemotePost(
  availableRemotePostsByKey: Map<string, AvailablePost[]>,
  waitTask: Task,
  waitRankId: number,
) {
  const remoteRankId = Number(waitTask.attributes.remoteRank);
  if (Number.isNaN(remoteRankId)) {
    return null;
  }

  const remotePostKey = getRemoteNotifyKey(remoteRankId, waitRankId, waitTask);
  const posts = availableRemotePostsByKey.get(remotePostKey) ?? [];
  if (posts.length === 0) {
    return null;
  }

  return posts.shift() ?? null;
}

function addAvailableRemotePost(
  availableRemotePostsByKey: Map<string, AvailablePost[]>,
  task: Task,
  rankId: number,
  queueId: number,
) {
  const remoteRankId = Number(task.attributes.remoteRank);
  if (Number.isNaN(remoteRankId)) {
    return;
  }

  const remotePostKey = getRemoteNotifyKey(rankId, remoteRankId, task);
  const posts = availableRemotePostsByKey.get(remotePostKey) ?? [];
  posts.push({
    queueId,
    rankId,
    task,
    taskIndex: task.index,
  });
  availableRemotePostsByKey.set(remotePostKey, posts);
}

function getStreamStates(group: ParseGroup): StreamState[] {
  return group.ranks.flatMap((rank) =>
    rank.streams.map((stream) => ({
      pointer: 0,
      rank,
      startTime: 0,
      stream,
    })),
  );
}

function clearTaskInteraction(task: Task) {
  delete task.postToTask;
  delete task.waitFromTask;
}

function markRemainingTasksNonReachable(state: StreamState, startIndex: number) {
  let markedTaskCount = 0;

  for (let index = startIndex; index < state.stream.tasks.length; index += 1) {
    const task = state.stream.tasks[index];
    task.span = 1;
    task.nonReachable = true;
    delete task.stuck;
    clearTaskInteraction(task);
    markedTaskCount += 1;
  }

  return markedTaskCount;
}

function simulateWaitSpans(group: ParseGroup) {
  const streamStates = getStreamStates(group);
  const totalTaskCount = streamStates.reduce(
    (sum, state) => sum + state.stream.tasks.length,
    0,
  );
  const availableLocalPostsByTopic = new Map<string, AvailablePost[]>();
  const availableRemotePostsByKey = new Map<string, AvailablePost[]>();
  let completedTaskCount = 0;
  let time = 0;

  while (completedTaskCount < totalTaskCount) {
    const completingTasks: Array<{ state: StreamState; task: Task }> = [];
    const completingLocalWaits: Array<{
      post: AvailablePost | null;
      state: StreamState;
      task: Task;
    }> = [];
    const completingRemoteWaits: Array<{
      post: AvailablePost;
      state: StreamState;
      task: Task;
    }> = [];
    let completedThisTick = 0;

    for (const state of streamStates) {
      const task = state.stream.tasks[state.pointer];
      if (!task) {
        continue;
      }

      if (task.name !== 'LocalWaitFrom' && task.name !== 'Wait') {
        completingTasks.push({ state, task });
      }
    }

    for (const { state, task } of completingTasks) {
      if (task.name === 'LocalPostTo') {
        addAvailableLocalPost(
          availableLocalPostsByTopic,
          task,
          state.rank.rankId,
          state.stream.queueId,
        );
      } else if (task.name === 'Post') {
        addAvailableRemotePost(
          availableRemotePostsByKey,
          task,
          state.rank.rankId,
          state.stream.queueId,
        );
      }
    }

    for (const state of streamStates) {
      const task = state.stream.tasks[state.pointer];
      if (!task) {
        continue;
      }

      if (task.name === 'LocalWaitFrom') {
        const topicId = task.attributes.topicId;
        if (topicId === undefined) {
          completingLocalWaits.push({ post: null, state, task });
          continue;
        }

        const post = getAvailableLocalPost(
          availableLocalPostsByTopic,
          state.rank.rankId,
          topicId,
          state.stream.queueId,
        );
        if (post !== null) {
          completingLocalWaits.push({ post, state, task });
        }
      } else if (task.name === 'Wait') {
        const post = getAvailableRemotePost(
          availableRemotePostsByKey,
          task,
          state.rank.rankId,
        );
        if (post !== null) {
          completingRemoteWaits.push({ post, state, task });
        }
      }
    }

    for (const { state, task } of completingTasks) {
      task.span = 1;
      delete task.nonReachable;
      delete task.stuck;
      clearTaskInteraction(task);
      state.pointer += 1;
      state.startTime = time + 1;
      completedTaskCount += 1;
      completedThisTick += 1;
    }

    for (const { post, state, task } of completingLocalWaits) {
      task.span = time + 1 - state.startTime;
      delete task.nonReachable;
      delete task.stuck;
      if (post === null) {
        delete task.waitFromTask;
      } else {
        task.waitFromTask = {
          queueId: post.queueId,
          rankId: post.rankId,
          taskIndex: post.taskIndex,
        };
      }

      state.pointer += 1;
      state.startTime = time + 1;
      completedTaskCount += 1;
      completedThisTick += 1;
    }

    for (const { post, state, task } of completingRemoteWaits) {
      task.span = time + 1 - state.startTime;
      delete task.nonReachable;
      delete task.stuck;
      task.waitFromTask = {
        queueId: post.queueId,
        rankId: post.rankId,
        taskIndex: post.taskIndex,
      };
      post.task.postToTask = {
        queueId: state.stream.queueId,
        rankId: state.rank.rankId,
        taskIndex: task.index,
      };

      state.pointer += 1;
      state.startTime = time + 1;
      completedTaskCount += 1;
      completedThisTick += 1;
    }

    if (completedThisTick === 0) {
      for (const state of streamStates) {
        const task = state.stream.tasks[state.pointer];
        if (!task || (task.name !== 'LocalWaitFrom' && task.name !== 'Wait')) {
          continue;
        }

        task.span = Math.max(1, time + 1 - state.startTime);
        delete task.nonReachable;
        task.stuck = true;
        clearTaskInteraction(task);
        const nonReachableTaskCount = markRemainingTasksNonReachable(
          state,
          state.pointer + 1,
        );
        state.pointer = state.stream.tasks.length;
        state.startTime = time + 1;
        completedTaskCount += 1 + nonReachableTaskCount;
        completedThisTick += 1 + nonReachableTaskCount;
      }
    }

    time += 1;
  }
}

function finalizeGroup(
  group: ParseGroup | null,
  fallbackTestName: string,
  groups: TestCase[],
) {
  if (!group || group.taskCount === 0) {
    return;
  }

  simulateWaitSpans(group);

  groups.push({
    testName: group.testName || fallbackTestName,
    ranks: group.ranks.map((rank) => ({
      rankId: rank.rankId,
      streams: rank.streams.map((stream) => ({
        queueId: stream.queueId,
        tasks: stream.tasks,
      })),
    })),
  });
}

export function parseStLog(contents: string): TestCase[] {
  const groups: TestCase[] = [];
  let currentGroup: ParseGroup | null = null;
  let latestRunName = '';

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();

    const runMatch = line.match(runPattern);
    if (runMatch) {
      latestRunName = runMatch[1] ?? '';
      continue;
    }

    if (line === 'rank id is 0') {
      currentGroup = createGroup(latestRunName);
      continue;
    }

    if (!currentGroup) {
      continue;
    }

    const resultMatch = line.match(resultPattern);
    if (resultMatch) {
      finalizeGroup(currentGroup, resultMatch[1] ?? '', groups);
      currentGroup = null;
      continue;
    }

    const rankMatch = line.match(rankHeaderPattern);
    if (rankMatch) {
      getRank(currentGroup, Number(rankMatch[1]));
      continue;
    }

    const taskMatch = line.match(taskPattern);
    if (!taskMatch) {
      continue;
    }

    const [, rankText, queueText, indexText, name, attributeText] = taskMatch;
    if (
      rankText === undefined ||
      queueText === undefined ||
      indexText === undefined ||
      name === undefined ||
      attributeText === undefined
    ) {
      continue;
    }

    const rankId = Number(rankText);
    const queueId = Number(queueText);
    const rank = getRank(currentGroup, rankId);
    const stream = getStream(rank, queueId);

    stream.tasks.push({
      index: Number(indexText),
      name,
      attributes: parseAttributes(attributeText),
    });
    currentGroup.taskCount += 1;
  }

  return groups;
}
