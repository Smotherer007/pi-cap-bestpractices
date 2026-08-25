---
name: sap-cap-best-practices
description: Complete SAP CAP (Cloud Application Programming Model) best-practices reference from cap.cloud.sap/docs - domain modeling, services and event handlers, transactions, security and authorization, error handling, logging, testing, i18n, TypeScript, dependencies, databases, and performance. Use when working on any SAP CAP / CDS project (Node.js @sap/cds or Java com.sap.cds), modeling CDS domains, defining services, writing handlers, or tuning security/performance.
license: MIT
---

# SAP CAP Best Practices

Complete reference of official best practices distilled from https://cap.cloud.sap/docs/ (CAP = SAP Cloud Application Programming Model). Use as a checklist while reviewing or writing CAP code, and as the source of truth for conventions and anti-patterns.

Primary sources: `node.js/best-practices`, `guides/domain`, `guides/services/providing-services`, `guides/services/custom-code`, `node.js/cds-tx`, `node.js/events`, `node.js/cds-log`, `node.js/cds-test`, `guides/security/authentication`, `guides/security/authorization`, `guides/databases/performance`, `guides/databases`, `guides/uis/i18n`, `node.js/typescript`, `tools/cds-lint`.

## When to Use

Trigger when working with SAP CAP / CDS (Node.js `@sap/cds` or Java `com.sap.cds`), or when the user mentions: CAP, CDS, `.cds` files, `@sap/cds`, `@sap/cds/common`, `cds watch`, `cds deploy`, domain modeling, entities, associations, compositions, aspects, `@restrict`, `@requires`, Fiori/SAPUI5, OData, SAP BTP, Cloud Foundry, Kyma, HANA, XSUAA, IAS, multitenancy. German keywords: "SAP CAP", "CDS Modell", "Domänenmodell", "Best Practices SAP".

## 1. Dependency Management

- **Caret ranges** (`^7.2.0`) for `@sap/*` and OSS packages — latest fixes + npm dedupe. Caret is npm's default.
- **Publishing for reuse**: keep open ranges, never pin exact versions, never `npm shrinkwrap`. `npm update` + test (in CI) before publishing.
- **Lock before deploying**: commit `package-lock.json` so deployments get the exact tested versions.
- **Minimize OSS packages**; run vulnerability checks for all direct + transitive deps.
- **Upgrade to latest majors** on a 6–12 month cycle (critical fixes reach recent majors in a ~2-month grace window).
- Automate with renovate/dependabot.

## 2. Security

- CAP's Node.js runtime does **not** auto-mount express middlewares — add `helmet` via `cds.on('bootstrap', app => app.use(helmet()))`.
- **CSP**: via helmet, customize `helmet.contentSecurityPolicy.getDefaultDirectives()`.
- **CSRF**: prefer App Router handling (default for non-GET/HEAD). Never cache the CSRF token (`Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`). At horizontal scale always handle CSRF at App Router (avoid per-VM token mismatch).
- **CORS**: configure in exactly ONE place (App Router preferred OR CAP server, never both). Allow-list origins in production.
- **Availability**: provide an anonymous `/health` ping (no auth). From `@sap/cds ^7.8` `/health` returns `{ status: 'UP' }` out of the box. Auth-protect sophisticated checks (e.g. DB availability) to avoid DoS.

## 3. Authentication

- **Start new projects with IAS** (Identity Authentication Service); XSUAA for legacy BTP landscapes. IAS + XSUAA can run hybrid during migration.
- **Mock users** (basic auth) for local dev/unit tests; deactivated in production by default. Define them in the development profile only.
- Integration tests in production profile **must verify unauthenticated users cannot access any endpoint**.
- Never share service keys or tokens. Delete service keys after CLI testing.
- CAP applications: at most one binding to an IAS/XSUAA instance.

## 4. Authorization (declarative access control)

- **By default CDS services have NO access control** — applications *must* implement proper authorization; CAP cannot infer it from the domain model.
- **Internal services**: annotate `@protocol: 'none'` so they aren't exposed to external clients.
- **Static**: `@readonly`, `@insertonly`, or OData `@Capabilities` (Insert/Update/DeleteRestrictions).
- **`@requires`** (service/entity/action): which (pseudo-)role is needed, e.g. `'authenticated-user'`, `'system-user'`.
- **`@restrict`** (entity, fine-grained): privilege `{ grant, to, where }` — grant = events (`READ`, `WRITE`, `*`, action names); to = roles (default `any`); where = instance filter.
- **Combined restrictions**: all hierarchy levels (service → entity → action) must pass (logical AND). Multiple privileges within one `@restrict` pass if **any** is met.
- **Instance-based**: `where: CreatedBy = $user`, `where: $user.country = countryCode`, `exists members[userId = $user and role = 'Editor']`.
- **`$user.<attr>` is a list**; empty/undefined list ⇒ predicate false ⇒ fully restricted. Use `valueRequired:true` (default) — unrestricted XSUAA attributes (`valueRequired:false`) are a footgun (adding a second restricted role can *shrink* access unexpectedly).
- **Draft mode**: creator can edit/delete/activate their draft; no need to model draft events.
- **Auto-exposed entities** (`@cds.autoexpose`, code lists) are `@readonly`; implicitly auto-exposed entities are only reachable via navigation.
- **Best practice — dedicated services per role**: avoid one service mixing many roles with complex `where`/`exists`; prefer separate services (`AdminService`, `UsersService`).
- **Restrict on DB-entity level only in exceptional cases** (inheritance/override gets unclear). Service-entity restrictions inherit from the DB entity; explicit service-level `@restrict` *replaces* inherited ones.
- **Never strip auth filters** when modifying `SELECT`/queries in custom handlers.
- Deep `exists` paths can bottleneck — consider ACL tables for performance.

## 5. Services & APIs

- **One service per use case** (services are cheap). Anti-pattern: one service exposing all entities 1:1.
- **Services as facades/projections** on the domain model; expose only what the use case needs (`@readonly`, `@insertonly`, `excluding {...}`, denormalized views).
- Use `@cds.autoexpose` for code-list/value-list entities.

## 6. Event Handlers (custom logic)

- **Always prefer declarative techniques first** (status flows, constraints, `@mandatory`) over imperative handlers.
- Hooks: `on` (replaces default, interceptor stack), `before`/`after` (listeners, run in parallel; a throw vetoes).
- **Prefer local `req`** over `cds.context` for context properties (`cds.context` goes through `AsyncLocalStorage.getStore()` — minor overhead).
- `req.timestamp` — constant `Date` for the whole request (use for managed dates, not `new Date()`).
- `req.subject` — pointer to target instances, usable in single-row READ/UPDATE/DELETE and bound actions (`SELECT.from(req.subject)`).
- `req.reply(result)` / `return result` from `on` handlers. `req.reject({status, code, message, target})` is the preferred way to raise errors. `req.error()` collects multiple errors. `req.warn/info/notify()` for non-error messages (validate user input to avoid injection).
- **Use `@mandatory` / `@assert.*` instead of hand-writing input checks.**
- `req.on('succeeded'/'failed'/'done')` run **outside** the transaction — use `cds.spawn()` or `cds.tx()` for DB work there. Use `req.before('commit')` to veto.

## 7. Transactions

- **You don't have to care** — CAP auto-manages begin/commit/rollback, connection pooling, principal propagation, tenant isolation. Within handlers you're always in a transaction.
- **Nested transactions** auto-commit/rollback with the root, but are **not a distributed atomic transaction** (one nested commit can succeed while another fails).
- **Manual transactions**: `cds.tx(fn)` starts a root tx and auto-commits/rolls back. Only needed outside managed (handler) environments.
- `cds.spawn({user, tenant, every/after}, fn)` for background jobs (detached continuation, own tx per run). **Await all async ops inside the callback.**
- `tx.commit()` / `tx.rollback()` release the physical connection — the `tx` can't be reused afterwards.
- SQLite: parallel transactions deadlock.

## 8. Data Types & Timestamps

- **`Decimal` and `Int64` are returned as strings** (HANA, PostgreSQL, SQLite). Do arithmetic in the DB (`UPDATE(Books).set('stock = stock + 1')`), never in JavaScript (silent precision loss past `Number.MAX_SAFE_INTEGER`).
- Use `req.timestamp` for managed dates; CAP converts `Date` to the correct DB format.

## 9. Domain Modeling

- **Capture intent (what), not implementation (how).**
- **KISS**; prefer **flat models** over deeply nested structured types.
- **Naming**: capitalize entity/type names, lowercase elements; plural entities, singular types; concise (no repeated context); `ID` for technical PKs.
- **Primary keys**: single-field, technical, immutable; canonic `cuid` (`key ID : UUID`); **prefer UUIDs** (DB sequences only for high volume). **Never interpret/validate UUIDs** (no case/hyphen/RFC-4122 assumptions, no string↔binary conversions).
- Use `@sap/cds/common`: `cuid`, `managed`, `temporal`, `Country`, `Currency`, `Language`. Custom types only with a reuse ratio.
- **Prefer managed `:1` associations**; to-many always need an `on`; many-to-many via link entity or composition-of-aspects.
- **Compositions** = contained-in (deep insert/update, cascaded delete, auto-exposed).
- **Localized data**: use `localized` qualifier, not hand-rolled `.texts`.
- **Managed data**: `@cds.on.insert`/`@cds.on.update` (`$now`, `$user`) or aspect `managed` — auto-filled, write-protected.
- **Separation of concerns** via aspects: keep auth and Fiori/UI annotations out of the core model.

## 10. CDS Modeling Performance

- **Avoid UNION** (re-model polymorphism via single entity + `type` enum + compositions, or de-normalized entity with aspects).
- **Avoid JOIN** in static views — use projections + associations + `$expand` (join only on demand).
- **Sort/filter before joining** (apply on the inner/child side first).
- **Calculated fields** (concat, formatting, algebra, `case`, dynamic) can't use DB indexes. Prefer: (1) UI computation, (2) pre-calculate **on write** (`= ... stored`), (3) on read, (4) event handler last resort. Disable sort/filter via `@Capabilities.SortRestrictions.NonSortableProperties`.
- **Compositions vs associations**: compositions for shared lifecycle/clear hierarchy/transactional togetherness; associations for changing relationships/independent lifecycles. For huge documents (thousands of children) decouple with associations.
- **Legacy migration**: convert string booleans, emulated decimals, positional strings, multi-column patterns, UNION/CASE; drop unnecessary VDM `C_`/`I_` abstraction views; keep service entities single-purpose (use actions/functions for complex logic).

## 11. Runtime Performance

- **Measure before optimizing**: define load profile, resources, KPI; take a 1-user baseline; isolate components one at a time.
- Findings (SAP test setup): CAP REST ≈ Express; **OData library significantly slower** → prefer **REST** for critical requests; SAP BTP routers and **HANA** limit throughput; token validation ~1.2–1.6×; **locale-specific sorting up to 16× slower** (disable when throughput matters); **scale-out is the main lever** (≈linear), Node.js **clustering** only ~20% + OOM risk (not recommended).
- Actions: REST over OData for critical paths, disable locale-specific sorting, scale out.

## 12. Logging

- Use `cds.log(id)` — cached/shared logger, `console`-like API. **Leave formatting to the log functions** (`LOG.debug('Expected', arg, 'but got', value)` not pre-formatted strings). Check `LOG._debug` etc. for expensive messages.
- Levels: `error` = unexpected, `warn` = expected/off-happy-path, `info` = brief progress, `debug` = detail, `trace` = exhaustive.
- Plain formatter in dev; **JSON formatter in production** (default). Integrate winston via `cds.log.Logger = cds.log.winstonLogger()`.
- **Mask sensitive headers** (`cds.log.mask_headers`, defaults authorization/cookie/cert/ssl); `sanitize_values` default `true`.
- Request correlation: `x-correlation-id` → `x-request-id` → `x-vcap-request-id`; `traceparent` → `trace_id`.

## 13. Testing

- `npm add -D @cap-js/cds-test`; use `cds.test(project)`, `GET`/`POST` shorthand, `defaults.auth`.
- **Call `cds.test()` first** — never touch `cds.env`/`cds.Service`/submodules before it. Enable `CDS_TEST_ENV_CHECK`.
- **Run `cds.test` once per test file.** Use `cds.test.in(folder)` instead of `process.chdir()`.
- **KISS — avoid excessive mocking**: "the more you mock, the less you test the real thing."
- **Minimal assertions**: assert stable error *codes* (`READONLY_ENTITY`), not messages. Don't snapshot whole responses — use `containSubset`. Check response *data* first, status code last (don't obscure errors).
- **Runner-agnostic**: stick to common `describe/test/expect` APIs; prefer Vitest over Jest for ESM/Chai.

## 14. Internationalization (i18n)

- Externalize literals to text bundles and reference `'{i18n>key}'` in annotations. Put bundles in `_i18n/` (`.properties` or CSV).
- Merging order: default fallback (`i18n.properties`) → default language (`i18n_en.properties`) → requested locale.
- Locale resolution: `sap-locale` param → `Accept-Language`. **Normalized locales use underscores** (`en_GB`, `i18n_en_GB.properties`); preserve only the whitelisted locales (`zh_CN`, `en_GB`, `fr_CA`, `pt_PT`, …).
- Ensure translations exist for preserved locales, else fallback is `en`.

## 15. TypeScript

- `cds add typescript`; `cds watch` auto-detects `tsconfig.json` and uses `tsx`. Prefer `tsx` over `ts-node` (no type checks = faster).
- **Always precompile TS for production** (`cds build` → run from `gen/srv`); `cds-tsx`/`tsx` are dev-only.
- **Import types from the `@sap/cds` facade only** — never from `@sap/cds/apis/...`. Add `@cap-js/cds-types` for IntelliSense.
- Use `cds-typer` (`#cds-models/...`) for model-derived types.

## 16. Databases & Schema Evolution

- CAP handles CDS→DDL compilation, deployment, and CSV initial-data loading automatically (`cds watch`/`cds deploy`).
- Dev = SQLite in-memory (or H2 for Java); prod = SAP HANA default (PostgreSQL in edge cases). Swap DBs without model/impl changes (inner-loop).
- Use the appropriate **schema evolution** strategy for development vs production.

## 17. cds-lint checklist (`@sap/eslint-plugin-cds`)

Run `cds lint`. Recommended rules encode these best practices — keep them green:
- **Authorization**: `auth-no-empty-restrictions`, `auth-restrict-grant-service`, `auth-use-requires`, `auth-valid-restrict-*` (grant/to/where/keys).
- **Naming/modeling**: `start-entities-uppercase`, `start-elements-lowercase`, `no-dollar-prefixed-names`, `no-db-keywords`, `no-java-keywords`.
- **Structure**: `no-cross-service-import`, `no-deep-sap-cds-import`, `no-join-on-draft`, `extension-restrictions`, `case-sensitive-well-known-events`.
- **JavaScript handlers**: `no-shared-handler-variable`, `use-cql-select-template-strings`.
- **SQL correctness**: `sql-null-comparison`, `sql-cast-suggestion`.
- **Data**: `valid-csv-header`, `assoc2many-ambiguous-key`.
- **Environment**: `latest-cds-version`.

## Pitfalls (anti-patterns to avoid)

- Pinning exact deps / publishing `npm-shrinkwrap.json` for reuse packages.
- Configuring CORS in both App Router and CAP server.
- Catching/swallowing unexpected errors; keeping the app running after an unexpected error; hiding error origins.
- `Decimal`/`Int64` arithmetic in JavaScript.
- Validating/interpreting UUIDs.
- Deeply nested structured types; excessive custom types with no reuse; over-abstracting the model.
- One service exposing all entities 1:1; mixing many roles in one service.
- Hand-writing input checks instead of `@mandatory`/`@assert`/constraints.
- Static views with UNION/JOIN; sort/filter after join; live calculated fields in `where`.
- Stripping authorization filters when modifying queries in handlers.
- DB work in `req.on('succeeded'/'failed')` without `cds.tx`/`cds.spawn`.
- `console.log` instead of `cds.log`; pre-formatted log strings.
- Testing error messages instead of codes; snapshot-testing whole responses; checking status codes first.
- `process.chdir()` in tests; touching `cds.env` before `cds.test()`; heavy mocking.
- Unrestricted XSUAA attributes (`valueRequired:false`).
- Clustering instead of scale-out for throughput.
