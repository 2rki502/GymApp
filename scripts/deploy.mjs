// Build the app and publish dist/ to the gh-pages branch (served by GitHub Pages).
// Usage: npm run deploy
import { execSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit' });
const out = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();

const remote = out('git remote get-url origin');
const commit = out('git rev-parse --short HEAD');
const dirty = out('git status --porcelain') !== '';

run('npm run build');

const dist = join(process.cwd(), 'dist');
writeFileSync(join(dist, '.nojekyll'), ''); // serve files as-is, no Jekyll processing
rmSync(join(dist, '.git'), { recursive: true, force: true });

run('git init -q -b gh-pages', dist);
run('git add -A', dist);
const name = out('git config user.name');
const email = out('git config user.email');
run(`git -c user.name="${name}" -c user.email="${email}" commit -q -m "Deploy ${commit}${dirty ? ' (+ uncommitted changes)' : ''}"`, dist);
run(`git push -q --force "${remote}" gh-pages`, dist);
rmSync(join(dist, '.git'), { recursive: true, force: true });

console.log('\nDeployed to gh-pages. GitHub Pages usually updates within a minute.');
