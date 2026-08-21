import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const composeFile = resolve(
  repositoryRoot,
  'infrastructure/docker/docker-compose.test.yml',
);
const projectName = `logistics-platform-e2e-${process.pid}`;
const databaseName = 'logistics_platform_test';
const databasePort = Number(process.env.E2E_DATABASE_PORT ?? 55433);
const packageManagerEntryPoint = process.env.npm_execpath;

if (!Number.isInteger(databasePort) || databasePort < 1024 || databasePort > 65535) {
  throw new Error('E2E_DATABASE_PORT must be an available port from 1024 through 65535');
}
if (!databaseName.endsWith('_test')) {
  throw new Error('Refusing to run E2E cleanup against a non-test database');
}
if (!packageManagerEntryPoint) {
  throw new Error('Run this workflow through pnpm test:e2e');
}

const testEnvironment = {
  ...process.env,
  NODE_ENV: 'test',
  E2E_DATABASE_PORT: String(databasePort),
  DATABASE_URL: `postgresql://postgres:postgres@localhost:${databasePort}/${databaseName}?schema=public`,
  JWT_ACCESS_SECRET:
    'isolated-e2e-jwt-secret-at-least-thirty-two-characters',
  JWT_ISSUER: 'logistics-operations-platform',
  JWT_AUDIENCE: 'logistics-platform-clients',
};

const composeArguments = [
  'compose',
  '-p',
  projectName,
  '-f',
  composeFile,
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    env: testEnvironment,
    stdio: 'inherit',
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited with status ${result.status}`);
  }
}

let failure;
try {
  run('docker', [...composeArguments, 'up', '-d', '--wait', '--wait-timeout', '60']);
  run(process.execPath, [packageManagerEntryPoint, 'prisma', 'migrate', 'deploy']);
  run(process.execPath, [packageManagerEntryPoint, '--filter', 'backend', 'test:e2e']);
} catch (error) {
  failure = error;
} finally {
  const cleanup = spawnSync(
    'docker',
    [...composeArguments, 'down', '--volumes', '--remove-orphans'],
    {
      cwd: repositoryRoot,
      env: testEnvironment,
      stdio: 'inherit',
    },
  );
  if (!failure && (cleanup.error || cleanup.status !== 0)) {
    failure = cleanup.error ?? new Error(`E2E database cleanup exited with status ${cleanup.status}`);
  }
}

if (failure) {
  console.error(failure.message);
  process.exitCode = 1;
}
