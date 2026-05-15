import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

import {
  skillsDir,
  usingSuperpowersSkillPath,
} from '@slowdini/superslow-core/paths';

assert.equal(path.isAbsolute(skillsDir), true, 'skillsDir should be absolute');
assert.equal(
  path.isAbsolute(usingSuperpowersSkillPath),
  true,
  'usingSuperpowersSkillPath should be absolute'
);
assert.equal(
  usingSuperpowersSkillPath,
  path.join(skillsDir, 'using-superpowers', 'SKILL.md'),
  'usingSuperpowersSkillPath should be derived from skillsDir'
);
assert.equal(fs.existsSync(skillsDir), true, 'skillsDir should exist');
assert.equal(
  fs.existsSync(usingSuperpowersSkillPath),
  true,
  'usingSuperpowersSkillPath should exist'
);
