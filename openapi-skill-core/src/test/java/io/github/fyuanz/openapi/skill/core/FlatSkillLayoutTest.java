package io.github.fyuanz.openapi.skill.core;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class FlatSkillLayoutTest {
    @Test void truncatedRouteNamesStayStableWhenAnotherRouteIsAdded() {
        String path = "/" + "x".repeat(200);
        var first = SemanticNames.operationFiles(java.util.List.of(Map.entry("get", path)));
        var next = SemanticNames.operationFiles(java.util.List.of(Map.entry("get", path), Map.entry("get", path + "y")));
        assertEquals(first.get("get\u0000" + path), next.get("get\u0000" + path));
        assertTrue(first.get("get\u0000" + path).matches(".*--[0-9a-f]{6}\\.md"));
    }

    @Test void emitsFlatDirectIndexAndKeepsReferencedSchemas() throws Exception {
        byte[] input = """
                {"openapi":"3.1.0","paths":{"/files":{"post":{"summary":"上传文件","operationId":"upload","tags":["文件","附件"],
                "responses":{"200":{"description":"ok","content":{"application/json":{"schema":{"$ref":"#/components/schemas/Node"}}}}}}}},
                "components":{"schemas":{"Node":{"type":"object","properties":{"next":{"$ref":"#/components/schemas/Node"}}}}}}
                """.getBytes(StandardCharsets.UTF_8);
        var files = new SkillGenerator().generate("storage", "api", Map.of("public", input));
        assertTrue(files.containsKey("references/index.md"));
        assertTrue(files.containsKey("references/operations/storage--public--post-files.md"));
        assertTrue(files.keySet().stream().allMatch(path -> path.split("/").length <= 3));
        assertFalse(files.keySet().stream().anyMatch(path -> path.contains("context") || path.contains("catalog") || path.contains("/groups/")));
        String index = files.get("references/index.md");
        assertTrue(index.contains("](operations/storage--public--post-files.md)"));
        assertTrue(index.contains("service=storage"));
        assertTrue(index.contains("document=public"));
        assertTrue(index.contains("附件"));
        assertTrue(files.get("references/operations/storage--public--post-files.md").contains("../schemas/storage--public--node.md"));
        assertEquals("openapi-skill-core/4", new ObjectMapper().readTree(files.get("references/source.json")).path("generatorVersion").asText());
        new GeneratedSkillValidator().validate(files, "storage", "api");
    }

    @Test void aggregatesLegacyOperationsWithoutPrecomputedClosure() throws Exception {
        byte[] input = """
                {"openapi":"3.1.0","paths":{"/x":{"get":{"responses":{"200":{"description":"ok","content":{"application/json":{"schema":{"$ref":"#/components/schemas/A"}}}}}}}},
                 "components":{"schemas":{"A":{"$ref":"#/components/schemas/B"},"B":{"$ref":"#/components/schemas/A"}}}}
                """.getBytes(StandardCharsets.UTF_8);
        var legacy = new java.util.TreeMap<>(new SkillGenerator().generateServiceTree("svc", "svc-api", Map.of("public", input)));
        var mapper = new ObjectMapper();
        var row = (com.fasterxml.jackson.databind.node.ObjectNode) mapper.readTree(legacy.get("references/operations.jsonl"));
        row.remove(java.util.List.of("closureFiles", "recursiveEdges", "groupFile", "group"));
        legacy.put("references/operations.jsonl", row + "\n");
        legacy.put("references/source.json", legacy.get("references/source.json").replace("core/3", "core/1"));
        String operation = "references/documents/public/operations/get-x.md";
        String content = legacy.get(operation);
        legacy.put(operation, content.substring(0, content.indexOf("## Complete referenced contracts"))
                + "## Referenced contracts\n\n- [A](../schemas/a.md)\n");
        var flat = new AggregateSkillGenerator().generate("project", "api", Map.of("svc", legacy));
        var mapped = mapper.readTree(flat.get("references/operations.jsonl"));
        assertEquals(2, mapped.path("closureFiles").size());
        assertFalse(mapped.path("recursiveEdges").isEmpty());
        assertTrue(flat.get("references/operations/svc--public--get-x.md").contains("../schemas/svc--public--b.md"));
        new GeneratedSkillValidator().validate(flat, "project", "api");
    }
}
