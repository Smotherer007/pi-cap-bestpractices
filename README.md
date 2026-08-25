# pi-cap-bestpractices

SAP CAP (Cloud Application Programming Model) best-practices **skill** for the [pi coding agent](https://github.com/earendil-works/pi).

A single self-contained skill that carries the official CAP best practices from [cap.cloud.sap/docs](https://cap.cloud.sap/docs/) — domain modeling, services & APIs, security, error handling, dependency management, and performance — so the agent applies them automatically when working on SAP CAP / CDS projects.

## Installation

```bash
# Install from npm (once published)
pi install npm:@patimweb/pi-cap-bestpractices

# Install from local path during development
pi install /path/to/pi-cap-bestpractices
```

## Usage

The skill is loaded on demand. Trigger it by working on CAP/CDS code, or explicitly:

```bash
/skill:sap-cap-best-practices
```

## Contents

The skill covers nine areas, each distilled into actionable rules with do/don't guidance:

| Area | Key topics |
|------|------------|
| Dependency Management | caret ranges, locking, OSS minimization, major upgrades |
| Security | helmet/CSP, CSRF, CORS, express hardening |
| Availability Checks | anonymous `/health` ping |
| Error Handling | let it crash, don't hide error origins |
| Data Types | `Decimal`/`Int64` as strings, `req.timestamp` |
| Domain Modeling | intent over implementation, naming, UUID keys, associations/compositions, aspects |
| Services & APIs | use-case-oriented services, facades/projections |
| CDS Modeling Performance | avoid UNION/JOIN, calculated fields, legacy migration |
| Runtime Performance | measure first, REST over OData, scale-out |

## Development

```bash
npm test          # validate SKILL.md frontmatter
npm test:watch    # run tests on change
```

## Publishing as a pi Package

To publish this skill to the [pi package catalog](https://pi.dev/packages):

1. Ensure `package.json` has `"keywords": ["pi-package"]`
2. Ensure `package.json` has a `"pi"` section declaring `"skills"` (or the conventional `skills/` directory)
3. Optionally add `"image"` or `"video"` preview URLs to the `"pi"` manifest
4. Publish to npm: `npm publish`
5. Users install with: `pi install npm:@patimweb/pi-cap-bestpractices`

The package catalog auto-discovers packages with the `pi-package` keyword from npm. Releases are automated via [semantic-release](https://semantic-release.gitbook.io/) on pushes to `main` (and pre-releases on `next`).

## License

MIT
