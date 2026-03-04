import fs from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const assertContains = (content, expected, context) => {
  if (!content.includes(expected)) {
    throw new Error(`Expected ${context} to include: ${expected}`);
  }
};

const main = async () => {
  const distIndexPath = path.resolve(process.cwd(), 'dist/index.html');
  const routesPath = path.resolve(process.cwd(), 'src/app/routes.tsx');

  if (!existsSync(distIndexPath)) {
    execSync('npm run build', { stdio: 'inherit' });
  }

  const [indexHtml, routesFile] = await Promise.all([
    fs.readFile(distIndexPath, 'utf8'),
    fs.readFile(routesPath, 'utf8'),
  ]);

  assertContains(indexHtml, '<div id="root"></div>', 'dist/index.html');
  assertContains(routesFile, 'path: "/login"', 'routes.tsx');
  assertContains(routesFile, 'path: "alerts"', 'routes.tsx');
  assertContains(routesFile, 'path: "pumps/:id"', 'routes.tsx');

  console.log('Frontend E2E smoke test passed');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
