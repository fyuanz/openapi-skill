# vue-ts-consumer

A real Vue 3 + TypeScript consumer that closes the loop between the
`openapi-skill` Skill generator, a running Spring Boot service, and a
frontend project that actually calls that service.

This consumer testbed complements `testbeds/springdoc-multi-package`, which verifies the runtime *producer*. This project
verifies the *consumer* — a real frontend project that installs the generated
Skill into its own `.agents/skills` directory and whose source code was written
to match the live OpenAPI contract.

## What it proves

1. A real Node project can install the npm package and generate one Skill from
   two live grouped OpenAPI endpoints.
2. The project-mode Skill uses the default name and lands in the consumer's own
   `.agents/skills/api-docs/`.
3. The frontend's typed client and the documented contract agree: every
   operation, parameter, status code and schema the UI relies on was verified
   against the running service.
4. The generated snapshot really is the live contract: the SHA-256 of both
   endpoint responses equals the digest recorded in the Skill's `source.json`.
5. Regenerating without a source change reproduces the identical tree, a failed
   download leaves the previous Skill byte-identical, and removing a service
   from the configuration deletes its subtree.

## Prerequisites

- Node.js 20 or newer
- Java 17 and Maven 3.9.x
- The backend service from `testbeds/springdoc-multi-package` running on
  `127.0.0.1:18080`

## 1. Start the backend

From the repository root:

```shell
mvn -B -DskipTests install
mvn -B -f testbeds/springdoc-multi-package/pom.xml spring-boot:run
```

Confirm both grouped documents are served:

```shell
curl http://127.0.0.1:18080/v3/api-docs/account
curl http://127.0.0.1:18080/v3/api-docs/business
```

## 2. Install and generate the Skill

```shell
cd testbeds/vue-ts-consumer
npm install
npm run skill:generate
```

`openapi-skill.config.json` declares one `springdoc-multi-package` service and
maps its account/business document IDs to the two live endpoints. It also
demonstrates project-, service-, and document-level keywords. Because `skillName`
is omitted, the output is `.agents/skills/api-docs/`:
`openapi-skill-core/2`, `kind=project`, one root `SKILL.md`, one complete unsplit `context.md` per document, clean
semantic contract paths, precomputed operation reference closures, and the service tree physically embedded under
`references/services/<serviceId>/`. JSONL indexes remain machine validation artifacts. All services
and documents are downloaded and validated before the complete project Skill is
replaced, so a failed download never damages a previously generated Skill or
publishes a partial service set.

Deleting a service from the configuration removes its whole subtree on the next
successful run. Note that whole-tree replacement applies within one Skill name:
switching from the legacy `springdoc-multi-package-api` layout to the default
`api-docs` name leaves the old directory in place, so delete it manually.

## 2b. Verify the generated Skill tree

```shell
node testbeds/vue-ts-consumer/verify-skill-tree.mjs
```

The verifier checks the file count, one unsplit `context.md` per document, the
absence of routine digest suffixes, that every relative Markdown link resolves,
that no trusted navigation file points at a JSONL index, that each operation page
states the exact security semantics, and it prints a whole-tree SHA-256. Run it
before and after a second `npm run skill:generate` to confirm the tree is
byte-stable; a changed source document must change the digest, and an unchanged
one must not.

The digest is only meaningful together with its definition, which the script
implements and documents inline: sha256 over the sorted
`relativePath + "\0" + sha256(fileBytes)` lines of the tree. Bare hashes recorded
in older reports used scripts that were not retained, so they cannot be compared
against this value.

## 3. Run the frontend

```shell
npm run dev
```

Open `http://localhost:15173/`. The dev server proxies `/api/*` to
`http://127.0.0.1:18080`, so the page exercises genuine HTTP calls. Each panel
shows the raw response and the HTTP status.

Also available:

```shell
npm run build   # vue-tsc strict type check + production build
```

## The five exercised operations

| Group | Operation | Verified behaviour |
| --- | --- | --- |
| account | `GET /users` | `keyword` is an optional filter; no match returns `[]` |
| account | `GET /users/{id}` | optional `X-Request-Id` header; unknown id returns `404` + `ApiError` |
| business | `POST /orders` | `201` echoes the request body; invalid body returns `400` + `ApiError` |
| business | `POST /files` | `multipart/form-data` part named `file`; response is `{ "size": <bytes> }` |

## Note on authentication

`POST /orders` carries the `bearerAuth` security requirement in its contract, but
the sample service does not enforce it — a call without an `Authorization` header
still returns `201`. The frontend therefore sends no token. This is a property of
the sample service, not of the generated Skill.

## Generated artifacts are not committed

`node_modules/`, `dist/`, and `.agents/` are ignored. Regenerate the Skill with
`npm run skill:generate` after starting the backend.
