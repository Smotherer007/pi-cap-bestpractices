---
name: sap-cap-best-practices
description: Complete SAP CAP (Cloud Application Programming Model) best-practices reference from cap.cloud.sap/docs and the SAP BTP Developer Guide, covering both Node.js (@sap/cds) and Java (com.sap.cds) runtimes - project setup, domain modeling, services and event handlers, transactions, querying, security, authorization, data privacy and audit logging, change tracking, error handling, logging, telemetry, testing, i18n, TypeScript, databases, messaging, multitenancy, production deployment, and performance. Use when working on any SAP CAP / CDS project, modeling CDS domains, defining services, writing handlers, or tuning security/performance.
license: MIT
---

# SAP CAP Best Practices

Complete reference of official best practices distilled from https://cap.cloud.sap/docs/ (CAP = SAP Cloud Application Programming Model), covering **both runtimes** — Node.js (`@sap/cds`) and Java (`com.sap.cds`). Use as a checklist while reviewing or writing CAP code, and as the source of truth for conventions and anti-patterns.

## When to Use

Trigger when working with SAP CAP / CDS (Node.js `@sap/cds` or Java `com.sap.cds`), or when the user mentions: CAP, CDS, `.cds` files, `@sap/cds`, `@sap/cds/common`, `cds watch`, `cds deploy`, domain modeling, entities, associations, compositions, aspects, `@restrict`, `@requires`, Fiori/SAPUI5, OData, SAP BTP, Cloud Foundry, Kyma, HANA, XSUAA, IAS, multitenancy. German keywords: "SAP CAP", "CDS Modell", "Domänenmodell", "Best Practices SAP".

---

## 1. Project Setup & Dependencies

### 1.1 Node.js vs Java bootstrap
- **Node.js**: `cds init <project> --add sample`; serve with `cds watch`. `@sap/cds` + `@sap/cds-dk` (CLI).
- **Java**: `cds init <project> --java` or the Maven archetype (`cds-services-archetype`); build/run with `mvn spring-boot:run`. Requires Java 21+ (Java 25 recommended, e.g. SapMachine) and Maven 3.9.14+. Modular: add features on demand via `cds-starter-cloudfoundry` / `cds-starter-k8s`.

### 1.2 Dependency rules (both runtimes)
- **Caret ranges** (`^7.2.0`) for `@sap/*` and OSS packages → latest fixes + npm dedupe.
- **Publishing for reuse**: keep open ranges, never pin exact versions, never `npm shrinkwrap`; `npm update` + test (in CI) before publishing.
- **Lock before deploying**: commit `package-lock.json` (Node.js) so deployments get exact tested versions.
- **Minimize OSS packages**; run vulnerability checks for all direct + transitive deps.
- **Upgrade to latest majors** on a 6–12 month cycle (critical fixes reach recent majors in a ~2-month grace window). Automate with renovate/dependabot.
- **CDS plugins (`@cap-js/*`)** — reuse `@cap-js/audit-logging`, `@cap-js/change-tracking`, `@cap-js/telemetry`, `@cap-js/hana`, `@cap-js/sqlite` etc. They are `cds-plugin`s that auto-configure, keeping annotations/config minimal.

---

## 2. Domain Modeling

Core principle: **capture intent (what), not implementation (how)** — keeps models concise and lets CAP provide optimized generic providers.

### 2.1 General style
- **KISS**; keep models concise/comprehensible; don't over-abstract.
- **Prefer flat models** over deeply nested structured types.
- **Separation of concerns** via aspects: keep the core domain model clean; put authorization, constraints, and UI/Fiori annotations in separate files (`extend` / `annotate`).
- **Naming**: capitalize entity/type names (`Authors`), lowercase elements (`name`); plural entities, singular types; concise names (no repeated context: `Authors.name` not `Authors.authorName`); `ID` for technical PKs.
- **Use `@sap/cds/common`**: `cuid`, `managed`, `temporal`, `Country`, `Currency`, `Language`. Custom types only with a reuse ratio.

### 2.2 Primary keys
- Single-field, technical, immutable; canonic `cuid` (`key ID : UUID`); **prefer UUIDs** (DB sequences only for high volume).
- **Never interpret/validate UUIDs** — unique opaque values. No case/hyphen/RFC-4122 assumptions, no string↔binary conversions (breaks ABAP `GUID_32` interop).

### 2.3 Associations & compositions
- **Prefer managed `:1` associations** (FKs/on-conditions auto-generated). To-many always need an `on`. Many-to-many via link entity or composition-of-aspects.
- **Compositions** = contained-in (deep insert/update, cascaded delete, auto-exposed). Use for document structures.
- Deep WRITE (compositions) only works OOTB if the on-condition uses only `=` comparisons joined by `AND` with refs/`$self`.

### 2.4 Localized & managed data
- **Localized data**: `localized` qualifier (`title : localized String`), not hand-rolled `.texts`.
- **Managed data**: `@cds.on.insert`/`@cds.on.update` (`$now`, `$user`) or aspect `managed` — auto-filled, write-protected. Pseudo-vars: `$now` (UTC), `$user`, `$user.<attr>`, `$uuid`.

---

## 3. Services & APIs

### 3.1 Service design
- **One service per use case** (services are cheap). Anti-pattern: one service exposing all entities 1:1.
- **Services as facades/projections** on the domain model (`@readonly`, `@insertonly`, `excluding {...}`, denormalized views).
- Use `@cds.autoexpose` for code-list/value-list entities.

### 3.2 Served out-of-the-box (generic providers)
- CRUD, deep read/write (compositions vs associations handled differently: compositions deeply create/update, associations fill FKs to existing targets), auto UUID keys, `$search`, pagination (implicit 1000-record page limit), implicit sorting by PK, optimistic (ETags) + pessimistic (locks) concurrency.
- **Pagination**: configure `cds.query.limit.default/max` or `@cds.query.limit`. Reliable pagination (OData V4 only) via `cds.query.limit.reliablePaging` (Node.js) / `cds.query.limit.reliablePaging.enabled` (Java).
- **Concurrency**: ETag via `@odata.etag` on `modifiedAt`; pessimistic via `SELECT ... .forUpdate()`/`.forShareLock()` (Node.js) or `Select.lock()` (Java). Locking not on projections/views, not on SQLite.

### 3.3 Declarative constraints (input validation)
- Use `@mandatory`, `@assert: (case when ... end)`, `@assert.format`, `@assert.range` (incl. open intervals `(0)` and `_` infinity), `@assert.target`, `@readonly` instead of hand-written checks.
- `@assert` constraints are **pushed down to the database** (what-not-how).
- `@assert.format` uses ECMA 262 regex (Node.js) vs `java.util.regex.Pattern` (Java).
- `@assert.target` validates input (CREATE/UPDATE only, not referential integrity — use `@assert.integrity` for that); no cross-service checks.
- **Invariant constraints** on base entities must not reference other elements (views may not expose them).

### 3.4 Status-transition flows
- Declarative via `@flow.status`, `@from`, `@to` (and `$flow.previous`); built-in in Node.js, needs `cds-feature-flow` dependency in Java. Combine with `@readonly` + `default`. Generic handlers validate entry states (409 on mismatch) and set target states automatically.

### 3.5 Custom actions & functions
- **Actions** modify data, **functions** retrieve. Bound actions receive the entity's PK as implicit first argument. Implement via `srv.on('name', ...)`.
- **Node.js**: `this.on('sum', ({data:{x,y}}) => x+y)`; bound: `this.on('getStock','Foo', ({params:[id]}) => ...)`. Method-style subclasses supported.
- **Java**: `@On(event="...")` handlers; return the function's return type directly.

---

## 4. Event Handlers — Node.js vs Java

### 4.1 Registration & phases (Node.js)
- `srv.on/before/after(event, entity?, handler)`; `on` = fulfill (interceptor stack with `next()`), `before`/`after` = listeners (run in parallel; a throw vetoes).
- Implement in sibling `.js` file next to `.cds`, or `lib/`/`handlers/` subfolder, or via `@impl`/`impl` config. Subclass `cds.ApplicationService`, register in `init()`, call `super.init()`.
- **Best practices**: use **named function** handlers (not arrow) so `this` is the transactional derivate; prefer `before`/`after` for custom logic (`.on` only for actions/functions); use `req.error()` to collect multiple input errors; `srv.prepend()` to register before existing handlers.

### 4.2 Registration & phases (Java)
- Annotate methods with `@Before`/`@On`/`@After` on `@Component` classes implementing `EventHandler`; `@ServiceName` (class) and `event`/`entity`/`service` attributes on annotations.
- Handlers within a phase are **never concurrent** and have **no guaranteed order** unless `@HandlerOrder(EARLY/LATE)` is used (generic handlers run before EARLY and after LATE). `@On` can call `context.proceed()` to delegate to the next handler.
- Use event-specific typed `EventContext` (`CdsReadEventContext`, `getCqn()`, `setResult()`), typed data args (`List<Books>`), and generated constants (`Books_.CDS_NAME`, `CqnService.EVENT_READ`).
- `@Before` completes the phase early if it sets a result/`setCompleted()`; `@On` first handler to set a result wins; `@After` can replace the result.

### 4.3 Common context/reply (Node.js)
- Prefer local `req` over `cds.context` (avoids `AsyncLocalStorage.getStore()` overhead). `req.timestamp` (constant `Date`), `req.subject` (single-row READ/UPDATE/DELETE + bound actions), `req.data`, `req.params`, `req.query`.
- Reply with `req.reply(result)` / `return result`; reject with `req.reject({status, code, message, target})`; collect with `req.error()`; non-error `req.warn/info/notify()` (validate user input).
- `req.on('succeeded'/'failed'/'done')` run **outside** the transaction → use `cds.spawn()`/`cds.tx()` for DB work; use `req.before('commit')` to veto.

---

## 5. Transactions

- **You don't have to care** — CAP auto-manages begin/commit/rollback, connection pooling, principal propagation, tenant isolation. Within handlers you're always in a transaction.
- **Nested transactions** auto-commit/rollback with the root but are **not distributed-atomic** (one nested commit can succeed while another fails).
- **Manual (Node.js)**: `cds.tx(fn)` starts a root tx and auto-commits/rolls back (only needed outside managed handlers). `tx.commit()`/`tx.rollback()` release the connection — the `tx` can't be reused.
- **Background jobs (Node.js)**: `cds.spawn({user, tenant, every/after}, fn)` — detached continuation, own tx per run; **await all async ops inside**.
- SQLite: parallel transactions deadlock.
- **Java**: transactions handled via Spring (annotations/`TransactionTemplate`); context via `RequestContext` (`getUserInfo()`, tenant).

---

## 6. Querying (CQN / cds.ql)

### 6.1 Node.js (`cds.ql`)
- `SELECT/INSERT/UPSERT/UPDATE/DELETE` fluent API, tagged template literals, or `srv.run(query)`. Prefer reflected definitions (`const { Books } = cds.entities`) to avoid repeating namespaces.
- **Avoid SQL injection**: never string-concatenate user input into queries; never wrap tagged template strings in parentheses; values are always bound as parameters.
- Prefer `INSERT.into(Books).entries(SELECT.from(Products))` (native `INSERT INTO SELECT`, copies within the DB) over reading then inserting.
- `SELECT.one`, `.forUpdate()`, `.forShareLock()`, `.stream()`, `.foreach()`, `.pipeline()` (streaming only on `cds.DatabaseService`).

### 6.2 Java (CQN query API)
- Uniform query API via `Select`, `Insert`, `Update`, `Delete` builders; generated `Books_` query-builder interfaces for type-safe queries; `Result` for results.

---

## 7. Security & Data Privacy

### 7.1 Authentication
- **Start new projects with IAS** (Identity Authentication Service); XSUAA for legacy BTP. IAS + XSUAA can run hybrid.
- **Node.js**: mock users (basic auth) for dev/test, deactivated in production. `cds.on('bootstrap', app => app.use(helmet()))` for helmet/CSP; never cache CSRF tokens; configure CORS in ONE place (App Router preferred).
- **Java**: Spring Security auto-config activated only when BOTH deps (`cds-starter-cloudfoundry`/`cds-starter-k8s`) AND an XSUAA/IAS binding exist. `cds.security.authentication.mode` = `never`/`model-relaxed`(default)/`model-strict`/`always`. Mock users: `authenticated`, `system`, `privileged` (plus custom via `cds.security.mock.users`). Override via `@Order(1)` `SecurityFilterChain` or fully disable with `cds.security.authentication.authConfig.enabled: false`.
- At most one binding to an IAS/XSUAA instance; use plan `broker` for technical reuse APIs; never share service keys/tokens.
- Integration tests in production profile **must verify unauthenticated access is denied**.

### 7.2 Authorization (declarative access control)
- **By default CDS services have NO access control** — applications *must* implement authorization.
- `@protocol: 'none'` for internal services; `@readonly`/`@insertonly`/`@Capabilities` for static; `@requires` (service/entity/action) for role checks; `@restrict` (entity) for fine-grained `{ grant, to, where }`.
- Combined restrictions: all hierarchy levels must pass (AND); multiple privileges pass if any matches.
- Instance-based: `where: CreatedBy = $user`, `$user.country = countryCode` (`$user.<attr>` is a list; empty = fully restricted), `exists members[userId = $user and role = 'Editor']`.
- **Avoid unrestricted XSUAA attributes** (`valueRequired:false`) — adding a second restricted role can unexpectedly shrink access.
- Draft mode: creator can edit/delete/activate their draft. Auto-exposed entities are `@readonly`; implicitly auto-exposed reachable only via navigation.
- **Dedicated services per role** preferred over complex mixed restrictions; restrict on DB-entity level only in exceptional cases (inheritance/override unclear); **never strip auth filters** in custom handlers; deep `exists` paths can bottleneck → consider ACL tables.

### 7.3 Data protection & privacy
- Data **privacy** = who has access + lawful handling (legal); data **protection** = availability/integrity/confidentiality (measures).
- **Annotate personal data** with `@PersonalData` in a separate `srv/data-privacy.cds` file → automates audit logging, personal data management (PDM), and data retention management (DRM):
  - `@PersonalData: { EntitySemantics: 'DataSubject' | 'DataSubjectDetails', DataSubjectRole: 'Customer' }`
  - `@PersonalData.FieldSemantics: 'DataSubjectID'`, `@PersonalData.IsPotentiallyPersonal`, `@PersonalData.IsPotentiallySensitive`.

### 7.4 Audit logging (`@cap-js/audit-logging`)
- `npm add @cap-js/audit-logging` (a `cds-plugin` → auto-config). Audit categories: `audit.data-access` (read of sensitive personal data), `audit.data-modification`, `audit.security-events` (login/logout), `audit.configuration`.
- Generic handlers emit `SensitiveDataRead` / `PersonalDataModified` based on the `@PersonalData` annotations.
- Custom audit logs: `cds.on('served', ...)`, `const audit = await cds.connect.to('audit-log')`, then `audit.log('SecurityEvent', { data: {...} })` — wrap in `audit.tx(...)` when the default tx may already be finished.

### 7.5 Change tracking (`@cap-js/change-tracking`)
- `npm add @cap-js/change-tracking` (cds-plugin). Annotate with `@changelog`: entity-level `@changelog: { keys: [customer.name, createdAt] }`, field-level `@changelog`, association `@changelog: [customer.name]`. Provides a "Change History" UI with old/new values, user, timestamp, and change type.

---

## 8. Error Handling

- Distinguish **programming errors** (bugs — fix) from **operational errors** (runtime — handle).
- **Let it crash** for programming errors: fail loudly, log, don't over-`try/catch`, don't program defensively. Never keep running after an unexpected error (multitenant info-disclosure risk).
- **Don't hide error origins**: augment and re-throw the same object. Only wrap in a new error to strip sensitive details.
- Use `@mandatory`/`@assert` instead of hand-written checks. Error responses: `5xx` are sanitized to generic messages in production (`err.$sanitize = false` to opt out, with care).

---

## 9. Logging & Observability

- **Node.js**: `cds.log(id)` (cached/shared, `console`-like). Leave formatting to log functions; check `LOG._debug` etc. for expensive messages. Levels: error=unexpected, warn=expected, info=brief, debug=detail, trace=exhaustive. Plain formatter in dev, **JSON formatter in production**. `cds.log.Logger = cds.log.winstonLogger()` for winston.
- **Mask sensitive headers** (`cds.log.mask_headers`, defaults authorization/cookie/cert/ssl); `sanitize_values` default `true`.
- Request correlation: `x-correlation-id` → `x-request-id` → `x-vcap-request-id`; `traceparent` → `trace_id`.
- **Java**: SLF4J/Logback (Spring Boot); use Spring Actuator + Micrometer for metrics/health; leverage SAP Application Logging / Cloud Logging services.
- **Telemetry (`@cap-js/telemetry`)**: OOTB DB pool metrics; add custom metrics via OpenTelemetry (`metrics.getMeter()`, `meter.createUpDownCounter()`), attach to `after` handlers, and tag with `sap.tenancy.tenant_id`. Use SAP Cloud Logging for correlated logs/metrics/traces on CF and Kyma.

---

## 10. Testing

### 10.1 Node.js (`@cap-js/cds-test`)
- `cds.test(project)` + `GET`/`POST` shorthand + `defaults.auth`. **Call `cds.test()` first** (never touch `cds.env`/`cds.Service` before it); enable `CDS_TEST_ENV_CHECK`. Run `cds.test` once per file; use `cds.test.in(folder)` instead of `process.chdir()`.
- **KISS** — avoid excessive mocking ("the more you mock, the less you test"). Minimal assertions: assert stable error **codes**, not messages; use `containSubset`, not snapshots; check data first, status code last. Runner-agnostic APIs; prefer Vitest over Jest (ESM/Chai).

### 10.2 Java
- Spring Boot test support (`@SpringBootTest`, `@AutoConfigureMockMvc`, `@WithMockUser`). Test authorization with mock users; verify 401 for unauthenticated. Use the Maven `INTEGRATION_TEST` module for integration tests.

---

## 11. Internationalization (i18n)

- Externalize literals to `_i18n/*.properties` (or CSV) and reference `'{i18n>key}'`. Merging order: default fallback → default language → requested locale.
- Locale from `sap-locale` param → `Accept-Language`. **Normalized locales use underscores** (`en_GB`, `i18n_en_GB.properties`); preserve only whitelisted locales (`zh_CN`, `en_GB`, `fr_CA`, `pt_PT`, …). Ensure translations exist for preserved locales (fallback `en`).

---

## 12. TypeScript (Node.js)

- `cds add typescript`; `cds watch` auto-detects `tsconfig.json` and uses `tsx`. Prefer `tsx` over `ts-node` (faster, no type checks).
- **Always precompile TS for production** (`cds build` → run from `gen/srv`); `cds-tsx`/`tsx` are dev-only.
- **Import types from the `@sap/cds` facade only** — never `@sap/cds/apis/...`. Add `@cap-js/cds-types`; use `cds-typer` (`#cds-models/...`) for model-derived types.

---

## 13. Databases & Schema Evolution

- CAP handles CDS→DDL compilation, deployment, and CSV initial-data loading automatically (`cds watch`/`cds deploy`/`mvn`).
- Dev = SQLite in-memory (Node.js) / H2 (Java); prod = SAP HANA default (PostgreSQL in edge cases). Swap DBs without model/impl changes (inner-loop). Use the appropriate **schema evolution** strategy for dev vs prod.

---

## 14. Messaging & Events

- **Intrinsic eventing**: all services emit/consume events. `srv.emit(event, data)` (Node.js) / `service.emit(context)` (Java). Event handlers are **listeners** (all run concurrently) vs request `on` handlers are **interceptors**.
- **Always `await srv.emit()`** (not awaiting → invalid transaction state/deadlocks).
- Declare events in CDS (`event AverageRatings.Changed : AverageRatings;`). In-process messaging is free; cross-process via `cds.MessagingService` + message brokers (CloudEvents).

---

## 15. Multitenancy & Extensibility

- Enable with `cds add multitenancy` (+ `npm install`/`mvn install`). Uses `@sap/cds-mtxs` sidecar (`mtx/sidecar`).
- **Node.js**: adds `@sap/cds-mtxs`, `with-mtx-sidecar` profile; sidecar serves `ModelProviderService`, `DeploymentService`, `SaasProvisioningService`, `ExtensibilityService`. Local test: `cds watch mtx/sidecar` + `cds watch --with-mtx` + `cds subscribe t1 --to http://localhost:4005`.
- **Java**: adds `cds-feature-mt`, `with-mtx` profile, `cds.multi-tenancy.sidecar.url`; sidecar runs with `java` profile.
- Upgrade tenants with `cds-mtx upgrade '*'` (Node.js) / Java schema update guide. Unique `t0` metadata container. Tenants strictly isolated (separate DB/HDI container per tenant).

---

## 16. Performance

### 16.1 CDS modeling performance
- **Avoid UNION** (normalize via single entity + `type` enum + compositions, or de-normalize with aspects). **Avoid JOIN** in static views (use associations + `$expand`). **Sort/filter before joining**.
- **Calculated fields** can't use DB indexes → prefer (1) UI, (2) pre-calc on write (`= ... stored`), (3) on read, (4) event handler last resort. Disable sort/filter via `@Capabilities.SortRestrictions.NonSortableProperties`.
- **Compositions vs associations**; decouple huge documents (thousands of children) with associations.
- **Legacy migration**: convert string booleans, emulated decimals, positional strings, multi-column patterns, UNION/CASE; drop VDM `C_`/`I_` abstraction views.

### 16.2 Runtime performance
- **Measure before optimizing**: load profile, resources, KPI; 1-user baseline; isolate one component at a time.
- Findings: CAP REST ≈ Express; **OData library significantly slower** → REST for critical requests; SAP BTP routers + HANA limit throughput; token validation ~1.2–1.6×; **locale-specific sorting up to 16× slower** (disable when throughput matters); **scale-out is the main lever** (≈linear), Node.js clustering only ~20% + OOM risk (not recommended).
- Java: enable HANA `HEX` optimization mode for best persistence throughput.

---

## 17. cds-lint checklist (`@sap/eslint-plugin-cds`)

Run `cds lint`. Recommended rules encode these best practices:
- **Authorization**: `auth-no-empty-restrictions`, `auth-restrict-grant-service`, `auth-use-requires`, `auth-valid-restrict-*`.
- **Naming/modeling**: `start-entities-uppercase`, `start-elements-lowercase`, `no-dollar-prefixed-names`, `no-db-keywords`, `no-java-keywords`.
- **Structure**: `no-cross-service-import`, `no-deep-sap-cds-import`, `no-join-on-draft`, `extension-restrictions`, `case-sensitive-well-known-events`.
- **JS handlers**: `no-shared-handler-variable`, `use-cql-select-template-strings`.
- **SQL**: `sql-null-comparison`, `sql-cast-suggestion`.
- **Data**: `valid-csv-header`, `assoc2many-ambiguous-key`.
- **Environment**: `latest-cds-version`.

---

## 18. Production Preparation & Deployment

- Profiles: **development** (local), **hybrid** (cloud bindings via `cds bind`), **production** (deploy). Deployments use `production` automatically; inspect with `cds env requires -4 production`.
- **Node.js**: `cds add hana`, `cds add xsuaa` (adds `@sap/xssec` + `[production] auth: xsuaa` + `xs-security.json`), `cds add workzone-standard`/`portal`/`html5-repo`, `cds add mta`/`kyma`. Validate with `cds build --production`.
- **Java**: `cds add hana` (adds `cds-feature-hana` + `spring-boot-starter-actuator` for `/actuator/health/liveness|readiness`), `cds add xsuaa`, `cds add workzone`. Validate with `mvn clean package`.
- `@requires` annotations → XSUAA scopes + role templates in `xs-security.json` (one scope + role template per CDS role).
- **Draft**: always enable `@odata.draft.enabled` when a Fiori app needs user data input.

---

## Pitfalls (anti-patterns to avoid)

- Pinning exact deps / publishing `npm-shrinkwrap.json` for reuse packages.
- Configuring CORS in both App Router and CAP server; caching CSRF tokens.
- Catching/swallowing unexpected errors; hiding error origins; keeping the app running after an unexpected error.
- `Decimal`/`Int64` arithmetic in JavaScript; string-concatenating user input into queries.
- Validating/interpreting UUIDs; deeply nested structured types; excessive custom types.
- One service exposing all entities 1:1; mixing many roles in one service; hand-writing input checks instead of `@mandatory`/`@assert`.
- Static views with UNION/JOIN; sort/filter after join; live calculated fields in `where`.
- Stripping authorization filters when modifying queries in handlers.
- DB work in `req.on('succeeded'/'failed')` without `cds.tx`/`cds.spawn`; not `await`-ing `srv.emit()`.
- `console.log` instead of `cds.log`; pre-formatted log strings.
- Testing error messages instead of codes; snapshot-testing whole responses; checking status codes first; `process.chdir()` in tests; touching `cds.env` before `cds.test()`; heavy mocking.
- Unrestricted XSUAA attributes (`valueRequired:false`).
- Clustering instead of scale-out for throughput.
