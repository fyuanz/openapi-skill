package com.smartdoc.agent.core;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.Map;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;

class SkillGeneratorReferenceTest {
    private final SkillGenerator generator = new SkillGenerator();
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void keepsReusableComponentsNavigableAndTreatsExamplesAndExtensionsAsData() {
        String source = """
                {
                  "openapi":"3.1.0",
                  "info":{"title":"Reusable API","version":"1"},
                  "security":[{"auth":[]}],
                  "paths":{"/orders/{id}":{
                    "parameters":[{"$ref":"#/components/parameters/Id"}],
                    "post":{
                      "operationId":"replaceOrder",
                      "tags":["orders","writes"],
                      "requestBody":{"$ref":"#/components/requestBodies/OrderBody"},
                      "responses":{
                        "201":{"$ref":"#/components/responses/Created"},
                        "400":{"description":"bad request","headers":{"X-Limit":{"$ref":"#/components/headers/Rate"}}}
                      }
                    }
                  }},
                  "components":{
                    "parameters":{"Id":{"name":"id","in":"path","required":true,"schema":{"$ref":"#/components/schemas/IntId"}}},
                    "requestBodies":{"OrderBody":{"required":true,"content":{"application/json":{"schema":{"$ref":"#/components/schemas/Order"}}}}},
                    "responses":{"Created":{"description":"created","content":{"application/json":{"schema":{"$ref":"#/components/schemas/Order"}}}}},
                    "headers":{"Rate":{"description":"remaining requests","schema":{"type":"integer"},"example":{"$ref":"https://payload.invalid/not-a-reference"}}},
                    "examples":{"Payload":{"summary":"literal payload","value":{"$ref":"https://payload.invalid/not-a-reference"}}},
                    "securitySchemes":{"auth":{"type":"http","scheme":"bearer"}},
                    "schemas":{
                      "IntId":{"type":"integer","format":"int64"},
                      "Order":{"type":"object","properties":{"child":{"$ref":"#/components/schemas/Order"},"note":{"type":["string","null"]}}}
                    }
                  },
                  "tags":[{"name":"orders","description":"Order APIs"},{"name":"writes"}],
                  "x-example":{"$ref":"https://extension.invalid/not-a-reference"}
                }
                """;

        Map<String, String> files = generator.generate("orders", "orders-api", Map.of("public", bytes(source)));

        JsonNode operation = operation(files);
        assertEquals("id", operation.path("parameters").get(0).path("name").asText());
        assertEquals("#/components/requestBodies/OrderBody",
                operation.path("operation").path("requestBody").path("$ref").asText());
        assertEquals(0, files.keySet().stream().filter(path -> path.contains("/tags/")).count());
        assertTrue(files.get("references/operations.jsonl").contains("\"tags\":[\"orders\",\"writes\"]"));
        assertTrue(files.get("references/documents/public/context.md").contains("Order APIs"));
        assertTrue(files.keySet().stream().anyMatch(path -> path.contains("/refs/")));
        assertAllLinksResolve(files);
    }

    @Test
    void resolvesMultiLevelLocalPathItemReferences() {
        String source = """
                {
                  "openapi":"3.1.0",
                  "info":{"title":"Path items","version":"1"},
                  "paths":{"/shared":{"$ref":"#/components/pathItems/Alias"}},
                  "components":{
                    "pathItems":{
                      "Alias":{"$ref":"#/components/pathItems/Shared"},
                      "Shared":{
                        "parameters":[{"name":"trace","in":"header","required":false,"schema":{"type":"string"}}],
                        "get":{"operationId":"getShared","responses":{"200":{"description":"ok"}}}
                      }
                    }
                  }
                }
                """;

        Map<String, String> files = generator.generate("shared", "shared-api", Map.of("public", bytes(source)));

        assertEquals(1, files.keySet().stream().filter(path -> path.contains("/operations/")).count());
        JsonNode operation = operation(files);
        assertEquals("/shared", operation.path("path").asText());
        assertEquals("getShared", operation.path("operation").path("operationId").asText());
        assertEquals("trace", operation.path("parameters").get(0).path("name").asText());
        assertEquals("#/components/pathItems/Alias", operation.path("pathItemReference").path("$ref").asText());
        assertAllLinksResolve(files);
    }

    @Test
    void rejectsAmbiguousPathItemReferenceSiblingsAndMalformedContainers() {
        String sibling = """
                {"openapi":"3.1.0","info":{"title":"x","version":"1"},
                 "paths":{"/x":{"$ref":"#/components/pathItems/X","get":{"responses":{}}}},
                 "components":{"pathItems":{"X":{"get":{"responses":{}}}}}}
                """;
        var siblingError = assertThrows(IllegalArgumentException.class,
                () -> generator.generate("s", "api", Map.of("public", bytes(sibling))));
        assertTrue(siblingError.getMessage().contains("UNSUPPORTED"));

        for (String source : new String[]{
                "{\"openapi\":\"3.1.0\",\"paths\":{},\"components\":[]}",
                "{\"openapi\":\"3.1.0\",\"paths\":{},\"components\":{\"schemas\":[]}}",
                "{\"openapi\":\"3.1.0\",\"paths\":{\"/x\":{\"get\":{\"tags\":\"bad\",\"responses\":{}}}}}"
        }) {
            var error = assertThrows(IllegalArgumentException.class,
                    () -> generator.generate("s", "api", Map.of("public", bytes(source))));
            assertTrue(error.getMessage().contains("STRUCTURE"), error.getMessage());
        }
    }

    @Test
    void rejectsCyclicPathItemAlias() {
        String source = """
                {"openapi":"3.1.0","info":{"title":"x","version":"1"},
                 "paths":{"/x":{"$ref":"#/components/pathItems/A"}},
                 "components":{"pathItems":{"A":{"$ref":"#/components/pathItems/B"},"B":{"$ref":"#/components/pathItems/A"}}}}
                """;
        var error = assertThrows(IllegalArgumentException.class,
                () -> generator.generate("s", "api", Map.of("public", bytes(source))));
        assertTrue(error.getMessage().contains("cyclic"), error.getMessage());
    }

    @Test
    void followsReferencedExampleWithoutInterpretingItsLiteralValue() {
        String source = """
                {
                  "openapi":"3.1.0",
                  "info":{"title":"Examples","version":"1"},
                  "paths":{"/x":{"get":{"responses":{"200":{"description":"ok","content":{"application/json":{
                    "examples":{"sample":{"$ref":"#/components/examples/Literal"}}
                  }}}}}}},
                  "components":{"examples":{"Literal":{"value":{"$ref":"https://payload.invalid/literal"}}}}
                }
                """;

        Map<String, String> files = generator.generate("examples", "examples-api", Map.of("public", bytes(source)));

        assertTrue(files.values().stream().anyMatch(content -> content.contains("https://payload.invalid/literal")));
        assertAllLinksResolve(files);
    }

    @Test
    void acceptsTheLocalRootJsonPointer() {
        String source = """
                {"openapi":"3.1.0","info":{"title":"Root ref","version":"1"},"paths":{},
                 "components":{"schemas":{"WholeDocument":{"$ref":"#"}}}}
                """;

        Map<String, String> files = generator.generate("root-ref", "root-ref-api", Map.of("public", bytes(source)));

        assertAllLinksResolve(files);
        String rootReference = files.entrySet().stream()
                .filter(entry -> entry.getKey().contains("/refs/"))
                .map(Map.Entry::getValue)
                .findFirst()
                .orElseThrow();
        assertEquals("3.1.0", contract(rootReference).path("openapi").asText());
    }

    private byte[] bytes(String source) {
        return source.getBytes(StandardCharsets.UTF_8);
    }

    private JsonNode operation(Map<String, String> files) {
        return files.entrySet().stream()
                .filter(entry -> entry.getKey().contains("/operations/"))
                .map(Map.Entry::getValue)
                .map(this::contract)
                .findFirst()
                .orElseThrow();
    }

    private JsonNode contract(String markdown) {
        try {
            int start = markdown.indexOf('\n', markdown.indexOf("```json")) + 1;
            return mapper.readTree(markdown.substring(start, markdown.indexOf("\n```", start)));
        } catch (Exception error) {
            throw new AssertionError(error);
        }
    }

    private void assertAllLinksResolve(Map<String, String> files) {
        Pattern links = Pattern.compile("\\]\\(([^)]+)\\)");
        files.forEach((path, content) -> {
            if (!path.endsWith(".md")) return;
            var matcher = links.matcher(content);
            while (matcher.find()) {
                Path parent = Path.of(path).getParent();
                String resolved = (parent == null ? Path.of(matcher.group(1)) : parent.resolve(matcher.group(1)))
                        .normalize().toString().replace('\\', '/');
                assertTrue(files.containsKey(resolved), path + " -> " + resolved);
            }
        });
    }
}
