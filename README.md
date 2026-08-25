# pi-cap-bestpractices

SAP CAP (Cloud Application Programming Model) **skills** for the [pi coding agent](https://github.com/earendil-works/pi).

This package ships the official, SAP-maintained [**capire/skills**](https://github.com/capire/skills) repository as a git submodule, making the curated CAP skills available to pi. The previous hand-written skill has been replaced by the upstream skills, which follow the same open [Agent Skills](https://agentskills.io/specification) standard that pi implements.

## Included skills

| Skill | Purpose |
|-------|---------|
| `cap-developer` | Build/extend CAP apps (Node.js & Java): project setup, CDS modeling, declarative annotations, custom handlers |
| `cap-add-remote-service` | Consume external services (Calesi pattern): consumption views, delegation & federation handlers |
| `cap-upgrade` | Upgrade a CAP project to a newer CDS version (`cds upgrade` + manual major-jump workflows) |
| `cap-trivia` | Interactive CAP trivia quiz (requires the CAP MCP server) |

## Installation

```bash
# From npm (once published)
pi install npm:@patimweb/pi-cap-bestpractices

# From local path during development
pi install /path/to/pi-cap-bestpractices
```

## Usage

The skills are loaded on demand. Trigger them by working on CAP/CDS code, or explicitly:

```bash
/skill:cap-developer
/skill:cap-add-remote-service
/skill:cap-upgrade
```

## Keeping the skills up to date

The skills are tracked as a submodule pinned to a specific upstream commit. To pull the latest SAP skills:

```bash
git submodule update --remote skills
# review, then commit the updated submodule pointer
```

When cloning this repo fresh (including in CI), initialize the submodule:

```bash
git clone --recurse-submodules git@github.com:Smotherer007/pi-cap-bestpractices.git
# or, after a normal clone:
git submodule update --init --recursive
```

## Development

```bash
git submodule update --init --recursive   # first time
npm test                                  # validate every SKILL.md frontmatter
npm test:watch                            # run tests on change
```

## Publishing as a pi Package

The package declares `"pi.skills": ["./skills/skills"]` (the upstream repo keeps its skills under a nested `skills/` directory). CI initializes the submodule (`submodules: recursive`) before tests and release, so the skill content ships inside the npm tarball. Releases are automated via [semantic-release](https://semantic-release.gitbook.io/) on pushes to `main` (and pre-releases on `next`).

## License

- **This package** (packaging, workflows, config): MIT — Copyright Patrick Weppelmann.
- **The bundled skills** (`skills/`): Apache-2.0 — Copyright SAP SE or an SAP affiliate company and capire/skills contributors. See `skills/LICENSE` and `skills/LICENSES/`.
