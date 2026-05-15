const path = require("node:path");

const skillsDir = path.join(__dirname, "skills");
const usingSuperpowersSkillPath = path.join(
  skillsDir,
  "using-superpowers",
  "SKILL.md",
);

exports.skillsDir = skillsDir;
exports.usingSuperpowersSkillPath = usingSuperpowersSkillPath;
