import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const examplePath = resolve(repositoryRoot, 'apps/backend/.env.example');
const environmentPath = resolve(repositoryRoot, 'apps/backend/.env');

const defaults = {
  PORT: '3000',
  DATABASE_URL:
    'postgresql://postgres:postgres@localhost:5433/logistics_platform?schema=public',
  KAFKA_BROKER: 'localhost:9092',
  JWT_ISSUER: 'logistics-operations-platform',
  JWT_AUDIENCE: 'logistics-platform-clients',
};

const quote = (value) => `"${value}"`;
const generatedSecret = () => randomBytes(48).toString('base64url');

let contents = existsSync(environmentPath)
  ? readFileSync(environmentPath, 'utf8')
  : readFileSync(examplePath, 'utf8');
let changed = !existsSync(environmentPath);

function configuredValue(name) {
  const match = contents.match(new RegExp(`^${name}=(.*)$`, 'm'));
  return match?.[1].trim().replace(/^['"]|['"]$/g, '');
}

function setValue(name, value, replace = false) {
  const expression = new RegExp(`^${name}=.*$`, 'm');
  if (expression.test(contents)) {
    if (!replace) return;
    contents = contents.replace(expression, `${name}=${quote(value)}`);
  } else {
    contents = `${contents.trimEnd()}\n${name}=${quote(value)}\n`;
  }
  changed = true;
}

for (const [name, value] of Object.entries(defaults)) {
  setValue(name, value);
}

for (const name of ['BOOTSTRAP_ADMIN_SECRET', 'JWT_ACCESS_SECRET']) {
  const current = configuredValue(name);
  const needsSecret = !current || current === 'generate-on-setup';
  setValue(name, generatedSecret(), needsSecret);
}

if (changed) {
  writeFileSync(environmentPath, `${contents.trimEnd()}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  console.log('Backend environment created or updated with generated local secrets.');
} else {
  console.log('Backend environment is already configured; no values were changed.');
}
