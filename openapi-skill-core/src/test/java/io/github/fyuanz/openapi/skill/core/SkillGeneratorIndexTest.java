package io.github.fyuanz.openapi.skill.core;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;

class SkillGeneratorIndexTest {
    private static final Pattern LONG_HASH_FILE = Pattern.compile("(?:^|-)[0-9a-f]{64}\\.md$");
    private final ObjectMapper mapper = new ObjectMapper();

    @Test void emitsSemanticKeysShortReadablePathsAndMachineIndexes() throws Exception {
        String document = """
                {"openapi":"3.1.0","paths":{
                  "/users/{id}":{"get":{"operationId":"duplicate","summary":"Get user","tags":["users"],"responses":{"200":{"description":"ok","content":{"application/json":{"schema":{"$ref":"#/components/schemas/UserView"}}}}}}},
                  "/users":{"post":{"operationId":"duplicate","summary":"Create user","responses":{"201":{"description":"created"}}}}
                },"components":{"schemas":{"UserView":{"type":"object"},"user-view":{"type":"string"}}}}
                """;
        Map<String, String> files = new SkillGenerator().generate("svc", "svc-api",
                Map.of("public", document.getBytes(StandardCharsets.UTF_8)));

        assertEquals("openapi-skill-core/1",
                mapper.readTree(files.get("references/source.json")).path("generatorVersion").asText());
        assertTrue(files.containsKey("references/operations.jsonl"));
        assertTrue(files.containsKey("references/schemas.jsonl"));
        assertTrue(files.containsKey("references/conventions.md"));
        assertTrue(files.keySet().stream().anyMatch(path -> path.matches(
                ".*/operations/get-users-by-id--[0-9a-f]{6}\\.md")));
        assertTrue(files.keySet().stream().anyMatch(path -> path.matches(
                ".*/operations/post-users--[0-9a-f]{6}\\.md")));
        assertTrue(files.keySet().stream().anyMatch(path -> path.matches(
                ".*/schemas/user-view--[0-9a-f]{6}\\.md")));
        assertTrue(files.keySet().stream().noneMatch(path -> LONG_HASH_FILE.matcher(Path.of(path).getFileName().toString()).find()));

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
                        "schema:svc:public:#/components/schemas/UserView",
                        "schema:svc:public:#/components/schemas/user-view"),
                schemas.stream().map(row -> row.path("id").asText()).toList());
        assertTrue(schemas.stream().allMatch(row -> files.containsKey("references/" + row.path("file").asText())));
    }

    @Test void keepsCatalogSmallAndCentralizesDefaultSemantics() {
        String document = """
                {"openapi":"3.1.0","paths":{"/open":{"get":{"security":[],"responses":{}}}},
                 "components":{"schemas":{"Payload":{"type":"object"}}}}
                """;
        Map<String, String> files = new SkillGenerator().generate("svc", "svc-api",
                Map.of("public", document.getBytes(StandardCharsets.UTF_8)));

        String catalog = files.get("references/catalog.md");
        assertFalse(catalog.contains("GET /open"));
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

    @Test void extendsTheShortSuffixOnlyWhenAFileNameCollides() {
        String first = SemanticNames.file("UserView", "first");
        String extended = SemanticNames.file("UserView", "first", Set.of(first.toLowerCase(Locale.ROOT)));
        assertTrue(first.matches("user-view--[0-9a-f]{6}\\.md"));
        assertTrue(extended.matches("user-view--[0-9a-f]{10}\\.md"));
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
