import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const [, , pluginPath, scenario] = process.argv;

if (!pluginPath || !['present', 'missing', 'local-missing', 'unresolved'].includes(scenario)) {
  console.error('Usage: node test-bootstrap-caching.mjs PLUGIN_PATH present|missing|local-missing|unresolved');
  process.exit(2);
}

let existsCount = 0;
let readCount = 0;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../../../..');
const isolatedCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'bootstrap-caching-'));
const consumerCorePackageDir = path.join(
  isolatedCwd,
  'node_modules',
  '@slowdini',
  'superslow-core'
);
const consumerSkillsDir = path.join(consumerCorePackageDir, 'skills');
const consumerUsingSuperpowersSkillPath = path.join(
  consumerSkillsDir,
  'using-superpowers',
  'SKILL.md'
);
const consumerCoreRealpath = path.join(repoRoot, 'packages/core');
const localFallbackUsingSuperpowersSkillPath = path.resolve(
  path.dirname(pluginPath),
  '../../core/skills/using-superpowers/SKILL.md'
);
const localFallbackSkillsDir = path.dirname(path.dirname(localFallbackUsingSuperpowersSkillPath));
const expectedSkillsDir = scenario === 'local-missing'
  ? localFallbackSkillsDir
  : scenario === 'unresolved'
    ? null
    : path.join(consumerCoreRealpath, 'skills');
const expectedUsingSuperpowersSkillPath = scenario === 'local-missing'
  ? localFallbackUsingSuperpowersSkillPath
  : scenario === 'unresolved'
    ? null
    : path.join(consumerCoreRealpath, 'skills/using-superpowers/SKILL.md');

fs.writeFileSync(
  path.join(isolatedCwd, 'package.json'),
  JSON.stringify({
    name: 'bootstrap-caching-consumer',
    private: true,
  })
);

if (scenario === 'present' || scenario === 'missing') {
  fs.mkdirSync(path.dirname(consumerCorePackageDir), { recursive: true });
  fs.symlinkSync(path.join(repoRoot, 'packages/core'), consumerCorePackageDir, 'dir');
}

process.chdir(isolatedCwd);

process.on('exit', () => {
  fs.rmSync(isolatedCwd, { recursive: true, force: true });
});

const originalExistsSync = fs.existsSync;
const originalReadFileSync = fs.readFileSync;

fs.existsSync = function (...args) {
  if (isBootstrapSkillPath(args[0])) {
    existsCount += 1;
    if ((scenario === 'missing' || scenario === 'local-missing' || scenario === 'unresolved') &&
      normalizePath(args[0]) === normalizePath(expectedUsingSuperpowersSkillPath ?? localFallbackUsingSuperpowersSkillPath)) {
      return false;
    }
  }
  return originalExistsSync.apply(this, args);
};

fs.readFileSync = function (...args) {
  if (isBootstrapSkillPath(args[0])) {
    readCount += 1;
  }
  return originalReadFileSync.apply(this, args);
};

const mod = await import(pathToFileURL(pluginPath).href);
const plugin = await mod.SuperpowersPlugin({ client: {}, directory: '.' });
const config = {};
await plugin.config(config);
const transform = plugin['experimental.chat.messages.transform'];

const firstOutput = makeOutput(`${scenario} bootstrap first step`);
await transform({}, firstOutput);
const afterFirst = { existsCount, readCount };

const secondOutput = makeOutput(`${scenario} bootstrap second step`);
await transform({}, secondOutput);
const afterSecond = { existsCount, readCount };

const result = {
  scenario,
  consumerProjectDir: isolatedCwd,
  registeredSkillsPaths: config.skills?.paths ?? [],
  firstBootstrapParts: countBootstrapParts(firstOutput),
  secondBootstrapParts: countBootstrapParts(secondOutput),
  firstReadCount: afterFirst.readCount,
  secondReadCount: afterSecond.readCount,
  firstExistsCount: afterFirst.existsCount,
  secondExistsCount: afterSecond.existsCount,
};

const failures = scenario === 'present'
  ? assertPresentBootstrap(result)
  : scenario === 'missing'
    ? assertMissingBootstrap(result)
    : scenario === 'local-missing'
      ? assertLocalMissingBootstrap(result)
      : assertUnresolvedBootstrap(result);

if (failures.length > 0) {
  console.error(JSON.stringify(result, null, 2));
  for (const failure of failures) {
    console.error(`FAIL: ${failure}`);
  }
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));

function isBootstrapSkillPath(filePath) {
  return normalizePath(filePath).includes('using-superpowers/SKILL.md');
}

function normalizePath(filePath) {
  return String(filePath).replaceAll('\\', '/');
}

function makeOutput(text) {
  return {
    messages: [{
      info: { role: 'user' },
      parts: [{ type: 'text', text }],
    }],
  };
}

function countBootstrapParts(output) {
  return output.messages[0].parts.filter(
    (part) => part.type === 'text' && part.text.includes('EXTREMELY_IMPORTANT')
  ).length;
}

function assertPresentBootstrap(result) {
  const failures = [];
  if (result.registeredSkillsPaths.length !== 1) {
    failures.push(`expected config hook to register one skills path, got ${result.registeredSkillsPaths.length}`);
  }
  if (result.registeredSkillsPaths[0] !== expectedSkillsDir) {
    failures.push(`expected config hook to register consumer project core skillsDir, got ${JSON.stringify(result.registeredSkillsPaths[0])}`);
  }
  if (result.firstBootstrapParts !== 1) {
    failures.push(`expected first transform to inject one bootstrap part, got ${result.firstBootstrapParts}`);
  }
  if (result.secondBootstrapParts !== 1) {
    failures.push(`expected second transform to inject one bootstrap part, got ${result.secondBootstrapParts}`);
  }
  if (result.firstReadCount !== 1) {
    failures.push(`expected first transform to read SKILL.md once, got ${result.firstReadCount}`);
  }
  if (result.secondReadCount !== result.firstReadCount) {
    failures.push(`expected cached second transform to do no additional reads, got ${result.secondReadCount - result.firstReadCount}`);
  }
  if (result.secondExistsCount !== result.firstExistsCount) {
    failures.push(`expected cached second transform to do no additional exists checks, got ${result.secondExistsCount - result.firstExistsCount}`);
  }
  return failures;
}

function assertMissingBootstrap(result) {
  const failures = [];
  if (result.registeredSkillsPaths.length !== 1) {
    failures.push(`expected config hook to register one skills path, got ${result.registeredSkillsPaths.length}`);
  }
  if (result.registeredSkillsPaths[0] !== expectedSkillsDir) {
    failures.push(`expected config hook to register consumer project core skillsDir, got ${JSON.stringify(result.registeredSkillsPaths[0])}`);
  }
  if (result.firstBootstrapParts !== 0) {
    failures.push(`expected no bootstrap when SKILL.md is missing, got ${result.firstBootstrapParts}`);
  }
  if (result.secondBootstrapParts !== 0) {
    failures.push(`expected no bootstrap on second missing-file transform, got ${result.secondBootstrapParts}`);
  }
  if (result.firstReadCount !== 0 || result.secondReadCount !== 0) {
    failures.push(`expected missing file path to avoid reads, got ${result.secondReadCount}`);
  }
  if (result.firstExistsCount < 1) {
    failures.push('expected first transform to check whether SKILL.md exists');
  }
  if (result.secondExistsCount !== result.firstExistsCount) {
    failures.push(`expected missing-file result to be cached, got ${result.secondExistsCount - result.firstExistsCount} extra exists checks`);
  }
  return failures;
}

function assertUnresolvedBootstrap(result) {
  const failures = [];
  if (result.registeredSkillsPaths.length !== 0) {
    failures.push(`expected config hook to register no skills path when core is unresolved, got ${result.registeredSkillsPaths.length}`);
  }
  if (result.firstBootstrapParts !== 0) {
    failures.push(`expected no bootstrap when paths are unresolved, got ${result.firstBootstrapParts}`);
  }
  if (result.secondBootstrapParts !== 0) {
    failures.push(`expected no bootstrap on second unresolved transform, got ${result.secondBootstrapParts}`);
  }
  if (result.firstReadCount !== 0 || result.secondReadCount !== 0) {
    failures.push(`expected unresolved paths to avoid reads, got ${result.secondReadCount}`);
  }
  if (result.secondExistsCount !== result.firstExistsCount) {
    failures.push(`expected unresolved paths to avoid extra transform-time exists checks, got ${result.secondExistsCount - result.firstExistsCount}`);
  }
  return failures;
}

function assertLocalMissingBootstrap(result) {
  const failures = [];
  if (result.registeredSkillsPaths.length !== 1) {
    failures.push(`expected config hook to register one local fallback skills path, got ${result.registeredSkillsPaths.length}`);
  }
  if (normalizePath(result.registeredSkillsPaths[0]).replace(/^\/private/, '') !== normalizePath(localFallbackSkillsDir).replace(/^\/private/, '')) {
    failures.push(`expected config hook to register local fallback skills dir, got ${JSON.stringify(result.registeredSkillsPaths[0])}`);
  }
  if (result.firstBootstrapParts !== 0) {
    failures.push(`expected no bootstrap when local fallback SKILL.md is missing, got ${result.firstBootstrapParts}`);
  }
  if (result.secondBootstrapParts !== 0) {
    failures.push(`expected no bootstrap on second local fallback transform, got ${result.secondBootstrapParts}`);
  }
  if (result.firstReadCount !== 0 || result.secondReadCount !== 0) {
    failures.push(`expected local missing bootstrap to avoid reads, got ${result.secondReadCount}`);
  }
  if (result.firstExistsCount < 1) {
    failures.push('expected local fallback bootstrap path to be checked once');
  }
  if (result.secondExistsCount !== result.firstExistsCount) {
    failures.push(`expected local missing bootstrap result to be cached, got ${result.secondExistsCount - result.firstExistsCount} extra exists checks`);
  }
  return failures;
}
