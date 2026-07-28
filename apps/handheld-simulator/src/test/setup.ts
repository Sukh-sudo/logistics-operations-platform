import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

Object.defineProperty(navigator, 'vibrate', {
  configurable: true,
  value: vi.fn(),
});
