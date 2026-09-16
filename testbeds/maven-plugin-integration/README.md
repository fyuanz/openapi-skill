# Maven compile integration testbed

This standalone Java 17 reactor verifies the OpenAPI Skill Maven goal against real Maven lifecycle invocations.
`orders-service` owns a two-document Skill and `billing-service` owns a one-document Skill. Both publish below
the reactor's `target/generated-resources/openapi-skill/` parent. The plugin execution is declared only in each service owner module and
uses `<inherited>false>`.

The inputs under each module's `src/main/openapi/` are authoritative static OpenAPI sources for this testbed.
Reading them during every compile is current for that input model. This does not prove that runtime springdoc
documents are fresh during `compile`; a code-generated producer must separately provide and prove its preparation
step before the plugin runs.

From the repository root, run:

```powershell
powershell -NoProfile -File testbeds/maven-plugin-integration/verify.ps1
```

The verifier installs the plugin snapshot locally, then checks clean/ordinary/repeated/targeted/parallel compilation,
package traversal, per-service generation count and isolation, invalid/absent inputs, preserved prior output, first-run
failure, invalid configuration, blocked output, and an intentional Java compilation error. The broken source is
activated only by the `broken-business-build` profile.

## Aggregate and coexistence verification

The optional `aggregate-skills` profile adds [skill-set](skill-set/pom.xml), a coordinator with explicit dependencies
on both service modules. Its default `aggregate` mode reads the same static JSON and creates `platform-api` after
the independent outputs, including under parallel Maven builds. It does not infer readiness from parent-POM order.

```powershell
powershell -NoProfile -File testbeds/maven-plugin-integration/verify-aggregate.ps1
```

This verifier uses `1.2.0`, installs the current compatibility plugin, and checks parallel reactor order, standalone
`both`, `aggregate`, and `service` modes, repeat execution, failed-member retention, healthy-peer continuation,
and recovery. Failure injection modifies only copies below ignored `target/aggregate-verification/inputs/`.
Logs and outputs are in `target/aggregate-verification/`; final `both/` contains `orders-api`, `billing-api`, and
the self-contained `platform-api`, all with SUCCESS status after recovery.

Only change `openapi.skill.output.mode` to switch this fixture's output mode. Production configuration belongs in
one owner after document producers; when that owner uses `both`, remove duplicate independent writers. The static
testbed's `compile` phase does not prove runtime export at that phase. No real web environment is required;
generated Skill usability is reviewed manually by the user.
