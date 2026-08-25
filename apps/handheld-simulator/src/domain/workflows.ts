import type { HandheldAction, TaskType } from './types';

export interface ActionDefinition {
  value: HandheldAction;
  label: string;
  instruction: string;
  identifier: 'PACKAGE' | 'CONTAINER' | 'NONE';
  needsContainer?: boolean;
  needsTrailer?: boolean;
  needsRoute?: boolean;
  delivery?: boolean;
}

export interface TaskDefinition {
  type: TaskType;
  category: 'TRAILER_OPERATIONS' | 'LAST_MILE_LOADING' | 'COURIER_DELIVERY';
  label: string;
  shortLabel: string;
  description: string;
  actions: ActionDefinition[];
}

const action = (
  value: HandheldAction,
  label: string,
  instruction: string,
  identifier: ActionDefinition['identifier'],
  requirements: Omit<
    ActionDefinition,
    'value' | 'label' | 'instruction' | 'identifier'
  > = {},
): ActionDefinition => ({ value, label, instruction, identifier, ...requirements });

export const TASKS: TaskDefinition[] = [
  {
    type: 'TRAILER_LOAD',
    category: 'TRAILER_OPERATIONS',
    label: 'Load trailer',
    shortLabel: 'Trailer load',
    description: 'Load packages or closed containers into a selected trailer.',
    actions: [
      action('LOAD_PACKAGE_TO_TRAILER', 'Load package', 'Scan the next package', 'PACKAGE', { needsTrailer: true }),
      action('UNLOAD_PACKAGE_FROM_TRAILER', 'Remove package', 'Scan the package to remove', 'PACKAGE', { needsTrailer: true }),
      action('LOAD_CONTAINER_TO_TRAILER', 'Load closed container', 'Scan a closed container', 'CONTAINER', { needsTrailer: true }),
      action('UNLOAD_CONTAINER_FROM_TRAILER', 'Remove container', 'Scan the container to remove', 'CONTAINER', { needsTrailer: true }),
      action('CLOSE_TRAILER', 'Close trailer', 'Confirm the selected trailer is ready to close', 'NONE', { needsTrailer: true }),
    ],
  },
  {
    type: 'TRAILER_UNLOAD',
    category: 'TRAILER_OPERATIONS',
    label: 'Unload trailer',
    shortLabel: 'Trailer unload',
    description: 'Unload freight from a selected inbound trailer.',
    actions: [
      action('UNLOAD_PACKAGE_FROM_TRAILER', 'Unload package', 'Scan the next package', 'PACKAGE', { needsTrailer: true }),
      action('LOAD_PACKAGE_TO_TRAILER', 'Restore package', 'Scan the package to restore', 'PACKAGE', { needsTrailer: true }),
      action('UNLOAD_CONTAINER_FROM_TRAILER', 'Unload container', 'Scan the next container', 'CONTAINER', { needsTrailer: true }),
      action('LOAD_CONTAINER_TO_TRAILER', 'Restore closed container', 'Scan the closed container', 'CONTAINER', { needsTrailer: true }),
    ],
  },
  {
    type: 'CONTAINER_LOAD',
    category: 'TRAILER_OPERATIONS',
    label: 'Load container',
    shortLabel: 'Container load',
    description: 'Pair each package scan with its destination container.',
    actions: [
      action('LOAD_PACKAGE_TO_CONTAINER', 'Load package', 'Scan package and destination container', 'PACKAGE', { needsContainer: true }),
      action('UNLOAD_PACKAGE_FROM_CONTAINER', 'Remove package', 'Scan package and container', 'PACKAGE', { needsContainer: true }),
      action('CLOSE_CONTAINER', 'Close container', 'Scan the container to close', 'CONTAINER', { needsContainer: true }),
    ],
  },
  {
    type: 'CONTAINER_UNLOAD',
    category: 'TRAILER_OPERATIONS',
    label: 'Unload container',
    shortLabel: 'Container unload',
    description: 'Remove or restore packages using paired package and container scans.',
    actions: [
      action('UNLOAD_PACKAGE_FROM_CONTAINER', 'Unload package', 'Scan package and source container', 'PACKAGE', { needsContainer: true }),
      action('LOAD_PACKAGE_TO_CONTAINER', 'Restore package', 'Scan package and container', 'PACKAGE', { needsContainer: true }),
    ],
  },
  {
    type: 'LAST_MILE_LOADING',
    category: 'LAST_MILE_LOADING',
    label: 'Last-mile loading',
    shortLabel: 'Last mile',
    description: 'Load packages into a selected route and truck context.',
    actions: [
      action('LOAD_PACKAGE_TO_ROUTE', 'Load package', 'Scan the next route package', 'PACKAGE', { needsRoute: true }),
      action('REMOVE_PACKAGE_FROM_ROUTE', 'Remove package', 'Scan the package to remove', 'PACKAGE', { needsRoute: true }),
    ],
  },
  {
    type: 'COURIER_DELIVERY',
    category: 'COURIER_DELIVERY',
    label: 'Courier delivery',
    shortLabel: 'Delivery',
    description: 'Record delivery milestones with best-effort location capture.',
    actions: [
      action('PACKAGE_OUT_FOR_DELIVERY', 'Out for delivery', 'Scan a route package', 'PACKAGE', { needsRoute: true, delivery: true }),
      action('PACKAGE_DELIVERED', 'Delivered', 'Scan the delivered package', 'PACKAGE', { needsRoute: true, delivery: true }),
      action('PACKAGE_ATTEMPTED_DELIVERY', 'Attempted', 'Scan the attempted package', 'PACKAGE', { needsRoute: true, delivery: true }),
      action('PACKAGE_DAMAGED', 'Damaged', 'Scan the damaged package', 'PACKAGE', { needsRoute: true, delivery: true }),
      action('PACKAGE_MISROUTED', 'Misrouted', 'Scan the misrouted package', 'PACKAGE', { needsRoute: true, delivery: true }),
      action('PACKAGE_RETURNED_TO_TERMINAL', 'Return to terminal', 'Scan the returned package', 'PACKAGE', { needsRoute: true, delivery: true }),
    ],
  },
];

export function taskDefinition(type: TaskType) {
  const task = TASKS.find((candidate) => candidate.type === type);
  if (!task) throw new Error(`Unknown handheld task: ${type}`);
  return task;
}

export function actionDefinition(value: HandheldAction) {
  const definition = TASKS
    .flatMap((task) => task.actions)
    .find((candidate) => candidate.value === value);
  if (!definition) throw new Error(`Unknown handheld action: ${value}`);
  return definition;
}

export function visibleTasks(authorized: string[]) {
  return TASKS.filter((task) => authorized.includes(task.category));
}
