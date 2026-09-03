import { In } from 'typeorm';

import { type WorkspaceRepository } from 'src/engine/twenty-orm/repository/workspace-repository';
import { OPEN_TASK_STATUSES } from 'src/modules/person/constants/open-task-statuses.constant';
import { type TaskTargetWorkspaceEntity } from 'src/modules/task/standard-objects/task-target.workspace-entity';
import { type TaskWorkspaceEntity } from 'src/modules/task/standard-objects/task.workspace-entity';

// People with no open tasks are absent from the result rather than mapped to 0,
// so callers must default missing ids themselves.
export const computeOpenTaskCountByPersonId = async ({
  taskTargetRepository,
  taskRepository,
  personIds,
}: {
  taskTargetRepository: WorkspaceRepository<TaskTargetWorkspaceEntity>;
  taskRepository: WorkspaceRepository<TaskWorkspaceEntity>;
  personIds: string[];
}): Promise<Map<string, number>> => {
  if (personIds.length === 0) {
    return new Map();
  }

  const taskTargets = await taskTargetRepository.find({
    select: ['taskId', 'targetPersonId'],
    where: { targetPersonId: In(personIds) },
  });

  const taskIds = [
    ...new Set(
      taskTargets
        .map(({ taskId }) => taskId)
        .filter((taskId): taskId is string => typeof taskId === 'string'),
    ),
  ];

  if (taskIds.length === 0) {
    return new Map();
  }

  const openTasks = await taskRepository.find({
    select: ['id'],
    where: { id: In(taskIds), status: In(OPEN_TASK_STATUSES) },
  });
  const openTaskIds = new Set(openTasks.map(({ id }) => id));

  // A task can be tied to the same person through several targets, so the count
  // is over distinct tasks rather than over target rows.
  const openTaskIdsByPersonId = new Map<string, Set<string>>();

  for (const { taskId, targetPersonId } of taskTargets) {
    if (
      typeof taskId !== 'string' ||
      typeof targetPersonId !== 'string' ||
      !openTaskIds.has(taskId)
    ) {
      continue;
    }

    const openTaskIdsForPerson =
      openTaskIdsByPersonId.get(targetPersonId) ?? new Set<string>();

    openTaskIdsForPerson.add(taskId);
    openTaskIdsByPersonId.set(targetPersonId, openTaskIdsForPerson);
  }

  return new Map(
    [...openTaskIdsByPersonId.entries()].map(([personId, taskIdsForPerson]) => [
      personId,
      taskIdsForPerson.size,
    ]),
  );
};
