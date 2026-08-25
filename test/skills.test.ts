import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function findSkillFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      out.push(...findSkillFiles(p));
    } else if (entry === "SKILL.md") {
      out.push(p);
    }
  }
  return out;
}

const skillsDir = new URL("../skills", import.meta.url).pathname;
const skillFiles = findSkillFiles(skillsDir);

test("at least one skill exists under skills/", () => {
  assert.ok(skillFiles.length > 0, "no SKILL.md found under skills/");
});

for (const file of skillFiles) {
  test(`skill has valid frontmatter: ${file}`, () => {
    const content = readFileSync(file, "utf8");
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    assert.ok(match, "missing YAML frontmatter");
    const frontmatter = match[1];

    assert.ok(/^name:\s*.+$/m.test(frontmatter), "missing required 'name' field");
    assert.ok(
      /^description:\s*.+$/m.test(frontmatter),
      "missing required 'description' field",
    );

    const name =
      frontmatter.match(/^name:\s*"?([^"\n]+)"?\s*$/m)?.[1]?.trim() ?? "";
    assert.match(
      name,
      /^[a-z0-9-]{1,64}$/,
      "name must be lowercase a-z, 0-9, hyphens, 1-64 chars",
    );
  });
}
