import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Load the documented backend .env before modules read security settings.
// Injected process variables retain precedence over values from the file.
const candidates = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), 'apps/backend/.env'),
];
const environmentFile = candidates.find((candidate) => existsSync(candidate));
if (environmentFile) process.loadEnvFile(environmentFile);
