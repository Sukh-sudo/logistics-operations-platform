import { Logger } from '@nestjs/common';

// Centralized application logger
// This gives us a single reusable logger instance
// instead of creating Logger objects everywhere.
export const AppLogger = new Logger('LogisticsPlatform');