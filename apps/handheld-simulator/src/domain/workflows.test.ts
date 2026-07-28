import { describe, expect, it } from 'vitest';
import { taskDefinition, visibleTasks } from './workflows';

describe('handheld workflow configuration', () => {
  it('limits courier work to employees authorized for courier delivery', () => {
    const tasks = visibleTasks(['TRAILER_OPERATIONS', 'LAST_MILE_LOADING']);

    expect(tasks.map((task) => task.type)).not.toContain('COURIER_DELIVERY');
    expect(tasks.map((task) => task.type)).toContain('TRAILER_LOAD');
    expect(tasks.map((task) => task.type)).toContain('LAST_MILE_LOADING');
  });

  it('requires paired container context for package-to-container work', () => {
    const load = taskDefinition('CONTAINER_LOAD').actions.find(
      (action) => action.value === 'LOAD_PACKAGE_TO_CONTAINER',
    );

    expect(load).toMatchObject({
      identifier: 'PACKAGE',
      needsContainer: true,
    });
  });

  it('marks every courier status as a delivery action with route context', () => {
    const delivery = taskDefinition('COURIER_DELIVERY');

    expect(delivery.actions).toHaveLength(6);
    expect(delivery.actions.every((action) => action.delivery && action.needsRoute)).toBe(true);
  });
});
