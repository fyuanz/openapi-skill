package io.github.fyuanz.openapi.skill.core;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import static org.junit.jupiter.api.Assertions.*;

class SkillGeneratorIndexTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test void emitsCore3ContextNavigationCleanPathsAndMachineIndexes() throws Exception {
        String document = """
                {"openapi":"3.1.0","paths":{
                  "/users/{id}":{"get":{"operationId":"duplicate","summary":"Get user","tags":["users"],"responses":{"200":{"description":"ok","content":{"application/json":{"schema":{"$ref":"#/components/schemas/UserView"}}}}}}},
                  "/users":{"post":{"operationId":"duplicate","summary":"Create user","responses":{"201":{"description":"created"}}}}
                },"components":{"schemas":{"UserView":{"type":"object"},"user-view":{"type":"string"},"Payload":{"type":"object"}}}}
                """;
        Map<String, String> files = new SkillGenerator().generate("svc", "svc-api",
                Map.of("public", document.getBytes(StandardCharsets.UTF_8)));

        assertEquals("openapi-skill-core/3",
                mapper.readTree(files.get("references/source.json")).path("generatorVersion").asText());
        assertTrue(files.containsKey("references/operations.jsonl"));
        assertTrue(files.containsKey("references/schemas.jsonl"));
        assertTrue(files.containsKey("references/conventions.md"));
        assertTrue(files.containsKey("references/documents/public/operations/get-users-by-id.md"));
        assertTrue(files.containsKey("references/documents/public/operations/post-users.md"));
        assertTrue(files.containsKey("references/documents/public/schemas/payload.md"));
        assertEquals(2, files.keySet().stream().filter(path -> path.matches(
                ".*/schemas/user-view--[0-9a-f]{6}\\.md")).count());

        String context = files.get("references/documents/public/context.md");
        assertTrue(context.contains("## Interface groups"));
        assertTrue(context.contains("[users](groups/users.md) — 1 interface(s)"));
        assertTrue(context.contains("[untagged](groups/untagged.md) — 1 interface(s)"));
        assertTrue(files.get("references/documents/public/groups/users.md")
                .contains("[Get user](../operations/get-users-by-id.md) — `GET /users/{id}`"));
        assertFalse(files.get("SKILL.md").contains("operations.jsonl"));
        assertFalse(files.get("SKILL.md").contains("schemas.jsonl"));
        assertTrue(files.get("SKILL.md").contains("context.md"));

        List<JsonNode> operations = jsonLines(files.get("references/operations.jsonl"));
        assertEquals(2, operations.size());
        assertEquals(List.of(
                        "operation:svc:public:get:/users/{id}",
                        "operation:svc:public:post:/users"),
                operations.stream().map(row -> row.path("id").asText()).toList());
        assertTrue(operations.stream().allMatch(row -> row.path("sourceOperationId").asText().equals("duplicate")));
        assertTrue(operations.stream().allMatch(row -> files.containsKey("references/" + row.path("file").asText())));

        List<JsonNode> schemas = jsonLines(files.get("references/schemas.jsonl"));
        assertEquals(List.of(
                        "schema:svc:public:#/components/schemas/Payload",
                        "schema:svc:public:#/components/schemas/UserView",
                        "schema:svc:public:#/components/schemas/user-view"),
                schemas.stream().map(row -> row.path("id").asText()).toList());
        assertTrue(schemas.stream().allMatch(row -> files.containsKey("references/" + row.path("file").asText())));
    }

    @Test void includesDiscoveryButNotSchemaBodiesAndCentralizesDefaultSemantics() {
        String document = """
                {"openapi":"3.1.0","paths":{"/open":{"get":{"security":[],"responses":{}}}},
                 "components":{"schemas":{"Payload":{"type":"object"}}}}
                """;
        Map<String, String> files = new SkillGenerator().generate("svc", "svc-api",
                Map.of("public", document.getBytes(StandardCharsets.UTF_8)));

        String catalog = files.get("references/catalog.md");
        assertTrue(catalog.contains("GET /open"));
        assertFalse(catalog.contains("```json"));
        assertFalse(catalog.contains("Payload"));
        assertTrue(catalog.contains("1 operation(s)"));
        assertTrue(catalog.contains("1 schema(s)"));

        String operation = files.entrySet().stream()
                .filter(entry -> entry.getKey().contains("/operations/"))
                .findFirst().orElseThrow().getValue();
        assertFalse(operation.contains("## How to read the defaults above"));
        assertTrue(operation.contains("conventions.md"));
        assertTrue(operation.contains("explicit empty `security`"));
        assertTrue(files.get("references/conventions.md").contains("not a claim"));
        assertEquals(1, files.values().stream().filter(value -> value.contains("## OpenAPI interpretation conventions")).count());
    }

    @Test void usesCleanNamesAndSuffixesEveryMemberOfARealCollisionGroup() {
        assertEquals("user-view.md", SemanticNames.files(Map.of("first", "UserView")).get("first"));
        Map<String, String> colliding = SemanticNames.files(Map.of("first", "UserView", "second", "user-view"));
        assertTrue(colliding.get("first").matches("user-view--[0-9a-f]{6}\\.md"));
        assertTrue(colliding.get("second").matches("user-view--[0-9a-f]{6}\\.md"));
        assertNotEquals(colliding.get("first"), colliding.get("second"));
        assertTrue(SemanticNames.files(Map.of("unicode", "航线任务")).get("unicode")
                .matches("item--[0-9a-f]{6}\\.md"));
        assertTrue(SemanticNames.files(Map.of("reserved", "CON")).get("reserved")
                .matches("con--[0-9a-f]{6}\\.md"));
    }

    @Test void validatorRejectsMissingOrDriftingIndexes() {
        Map<String, String> valid = new SkillGenerator().generate("svc", "svc-api",
                Map.of("public", "{\"openapi\":\"3.1.0\",\"paths\":{\"/x\":{\"get\":{\"responses\":{}}}}}"
                        .getBytes(StandardCharsets.UTF_8)));
        var missing = new TreeMap<>(valid);
        missing.remove("references/operations.jsonl");
        assertThrows(IllegalArgumentException.class,
                () -> new GeneratedSkillValidator().validate(missing, "svc", "svc-api"));

        var drifting = new TreeMap<>(valid);
        drifting.put("references/operations.jsonl",
                drifting.get("references/operations.jsonl").replace("documents/public/operations/", "documents/public/missing/"));
        assertThrows(IllegalArgumentException.class,
                () -> new GeneratedSkillValidator().validate(drifting, "svc", "svc-api"));

        var missingContext = new TreeMap<>(valid);
        missingContext.remove("references/documents/public/context.md");
        assertThrows(IllegalArgumentException.class,
                () -> new GeneratedSkillValidator().validate(missingContext, "svc", "svc-api"));

        var missingClosure = new TreeMap<>(valid);
        String operation = "references/documents/public/operations/get-x.md";
        missingClosure.put(operation, missingClosure.get(operation).replace("## Complete referenced contracts", "## References"));
        assertThrows(IllegalArgumentException.class,
                () -> new GeneratedSkillValidator().validate(missingClosure, "svc", "svc-api"));
    }

    @Test void groupsOperationsByFirstTagWithReadableNamesAndSlimmerEntries() {
        String document = """
                {"openapi":"3.1.0","info":{"title":"UAV Hub","version":"5.6.2"},
                 "servers":[{"url":"http://192.168.1.52:8071","description":"Generated server url"}],
                 "security":[{"Authorization":[],"ClientId":[]}],
                 "tags":[{"name":"航线任务","description":"航线任务管理"},
                         {"name":"设备管理","description":"设备列表、状态查询"},
                         {"name":"设备管理","description":"设备同步、列表查询、行政区挂载"}],
                 "paths":{
                   "/drone/task/page":{"post":{"tags":["航线任务"],"summary":"分页查询任务列表","operationId":"pageQuery","responses":{}}},
                   "/drone/device/list":{"get":{"tags":["设备管理"],"summary":"分页查询设备列表","operationId":"listDevices","responses":{}}},
                   "/drone/terra/reconstruction/model-file/{fileId}":{"delete":{"tags":["Terra重建管理"],"summary":"删除Terra模型文件","operationId":"deleteModelFile","responses":{}}},
                   "/drone/ping":{"get":{"summary":"无标签接口","operationId":"ping","responses":{}}}
                 },
                 "components":{"securitySchemes":{
                   "Authorization":{"type":"http","scheme":"bearer","bearerFormat":"JWT","name":"Authorization","in":"header"},
                   "ClientId":{"type":"apiKey","name":"clientid","in":"header"}}}}
                """;
        Map<String, String> files = new SkillGenerator().generate("uav-hub", "uav-hub-api",
                Map.of("uav", document.getBytes(StandardCharsets.UTF_8)));

        for (String tag : List.of("航线任务", "设备管理", "Terra重建管理", "untagged"))
            assertTrue(files.containsKey("references/documents/uav/groups/" + tag + ".md"),
                    "missing group file for " + tag);
        assertTrue(files.containsKey(
                "references/documents/uav/operations/delete-drone-terra-reconstruction-model-file-by-file-id.md"));

        String devices = files.get("references/documents/uav/groups/设备管理.md");
        assertTrue(devices.contains("设备列表、状态查询; 设备同步、列表查询、行政区挂载"));
        assertTrue(devices.contains("1 interface(s)."));
        assertTrue(devices.contains("[分页查询设备列表](../operations/get-drone-device-list.md) — `GET /drone/device/list`"));
        assertFalse(devices.contains("Source operationId"));
        assertFalse(devices.contains("Tags:"));

        String context = files.get("references/documents/uav/context.md");
        assertTrue(context.contains("[航线任务](groups/航线任务.md) — 1 interface(s)"));
        assertFalse(context.contains("```json"));
        assertFalse(context.contains("192.168.1.52"));

        String catalog = files.get("references/catalog.md");
        assertTrue(catalog.contains("192.168.1.52:8071"));
        assertTrue(catalog.contains("Authorization (http bearer JWT)"));
        assertTrue(catalog.contains("ClientId (apiKey clientid in header)"));

        assertEquals("AI-识别.md", SemanticNames.tagFiles(Map.of("a", "AI 识别")).get("a"));
        assertEquals("untagged.md", SemanticNames.tagFiles(Map.of("a", "   ")).get("a"));
        assertNotEquals("CON.md", SemanticNames.tagFiles(Map.of("a", "CON")).get("a"));
    }

    private List<JsonNode> jsonLines(String content) throws Exception {
        assertNotNull(content);
        var rows = new ArrayList<JsonNode>();
        for (String line : content.split("\\n")) {
            if (!line.isBlank()) rows.add(mapper.readTree(line));
        }
        return rows;
    }
}
