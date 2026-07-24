import { isValidElement } from 'react';
import { describe, expect, it } from 'vitest';
import { PublicLayout } from '../layouts/PublicLayout';
import { router } from './router';

describe('application routes', () => {
  it('keeps customer tracking and health on the public route branch', () => {
    const publicBranch = router.routes.find(route =>
      route.children?.some(child => child.path === '/tracking'),
    );
    const childPaths = publicBranch?.children?.map(route => route.path);

    expect(isValidElement(publicBranch?.element) && publicBranch.element.type === PublicLayout).toBe(true);
    expect(childPaths).toContain('/tracking/:shipmentNumber');
    expect(childPaths).toContain('/health');
  });
});
