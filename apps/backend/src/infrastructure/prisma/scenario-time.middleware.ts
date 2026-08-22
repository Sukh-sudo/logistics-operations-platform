import { Prisma } from '@prisma/client';

const operationTimeFields = new Set([
  'actualDeparture',
  'actualArrival',
  'completedAt',
  'lastActivityAt',
  'releasedAt',
  'sentAt',
  'readAt',
  'enrolledAt',
  'revokedAt',
  'lastAuthenticatedAt',
  'lastAcceptedActivityAt',
  'startedAt',
  'endedAt',
  'serverReceivedAt',
  'reversedAt',
  'unloadedAt',
  'processedAt',
]);

const models = new Map(
  Prisma.dmmf.datamodel.models.map((model) => [model.name, model]),
);

type WriteData = Record<string, unknown>;

const copyDate = (instant: Date) => new Date(instant.getTime());

function isNowDefault(value: unknown) {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    (value as { name?: unknown }).name === 'now'
  );
}

function applyCreateTime(modelName: string, data: WriteData, instant: Date) {
  const model = models.get(modelName);
  if (!model) return data;

  const result = { ...data };
  for (const field of model.fields) {
    if (field.kind !== 'scalar' || field.type !== 'DateTime') continue;

    if (field.isUpdatedAt || isNowDefault(field.default)) {
      result[field.name] = copyDate(instant);
      continue;
    }

    if (operationTimeFields.has(field.name) && field.name in result) {
      result[field.name] = copyDate(instant);
    }
  }
  return result;
}

function applyUpdateTime(modelName: string, data: WriteData, instant: Date) {
  const model = models.get(modelName);
  if (!model) return data;

  const result = { ...data };
  for (const field of model.fields) {
    if (field.kind !== 'scalar' || field.type !== 'DateTime') continue;

    if (field.isUpdatedAt || (operationTimeFields.has(field.name) && field.name in result)) {
      result[field.name] = copyDate(instant);
    }
  }
  return result;
}

/**
 * Adds simulated time only while ApplicationClock has an active override.
 * Normal API requests continue to use Prisma/PostgreSQL timestamp defaults.
 */
export function applyScenarioTime(
  params: Prisma.MiddlewareParams,
  instant: Date,
): Prisma.MiddlewareParams {
  if (!params.model || !params.args) return params;

  const args = { ...params.args } as Record<string, unknown>;
  if (params.action === 'create') {
    args.data = applyCreateTime(params.model, args.data as WriteData, instant);
  } else if (params.action === 'createMany' || params.action === 'createManyAndReturn') {
    const data = args.data;
    args.data = Array.isArray(data)
      ? data.map((item) => applyCreateTime(params.model!, item as WriteData, instant))
      : applyCreateTime(params.model, data as WriteData, instant);
  } else if (params.action === 'update' || params.action === 'updateMany') {
    args.data = applyUpdateTime(params.model, args.data as WriteData, instant);
  } else if (params.action === 'upsert') {
    args.create = applyCreateTime(params.model, args.create as WriteData, instant);
    args.update = applyUpdateTime(params.model, args.update as WriteData, instant);
  }

  return { ...params, args };
}
