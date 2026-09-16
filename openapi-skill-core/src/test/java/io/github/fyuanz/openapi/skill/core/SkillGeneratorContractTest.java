package io.github.fyuanz.openapi.skill.core;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;

class SkillGeneratorContractTest {
    private final SkillGenerator generator = new SkillGenerator();
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void preservesTransportSchemaAndInheritanceSemantics() throws Exception {
        String source = """
                {
                  "openapi":"3.1.0",
                  "info":{"title":"Contract API","version":"1"},
                  "servers":[{"url":"https://root.invalid"}],
                  "security":[{"auth":[]}],
                  "paths":{"/items/{id}":{
                    "servers":[{"url":"https://path.invalid"}],
                    "parameters":[
                      {"$ref":"#/components/parameters/IdAlias"},
                      {"$ref":"#/components/parameters/QueryAlias"}
                    ],
                    "patch":{
                      "operationId":"patchItem",
                      "deprecated":true,
                      "parameters":[{"name":"filter","in":"query","required":false,"style":"deepObject","explode":true,"schema":{"type":"object"}}],
                      "requestBody":{"required":true,"content":{
                        "application/json":{"schema":{"$ref":"#/components/schemas/Item"},"example":{"id":7}},
                        "multipart/form-data":{"schema":{"type":"object","properties":{"file":{"type":"string","format":"binary"}}},"encoding":{"file":{"contentType":"image/png"}}}
                      }},
                      "responses":{
                        "200":{"description":"ok","headers":{"ETag":{"schema":{"type":"string"}}},"content":{"application/json":{"schema":{"$ref":"#/components/schemas/Item"}}}},
                        "default":{"description":"failure","content":{"application/problem+json":{"schema":{"$ref":"#/components/schemas/Problem"}}}}
                      }
                    }
                  }},
                  "components":{
                    "parameters":{
                      "Id":{"name":"id","in":"path","required":true,"schema":{"type":"integer","format":"int64"}},
                      "IdAlias":{"$ref":"#/components/parameters/Id"},
                      "Query":{"name":"filter","in":"query","required":false,"style":"form","explode":false,"allowReserved":true,"schema":{"type":["string","null"]}},
                      "QueryAlias":{"$ref":"#/components/parameters/Query"}
                    },
                    "securitySchemes":{"auth":{"type":"oauth2","flows":{"clientCredentials":{"tokenUrl":"https://auth.invalid/token","scopes":{"read":"Read items"}}}}},
                    "schemas":{
                      "Base":{"type":"object","required":["id"],"properties":{"id":{"type":"integer","readOnly":true}}},
                      "Item":{"allOf":[
                        {"$ref":"#/components/schemas/Base"},
                        {"type":"object","required":["secret"],"properties":{
                          "secret":{"type":"string","writeOnly":true},
                          "state":{"type":"string","enum":["new","done"]},
                          "note":{"type":["string","null"]},
                          "aliases":{"type":"array","items":{"type":"string"}},
                          "attributes":{"type":"object","additionalProperties":{"type":"integer"}}
                        }}
                      ]},
                      "Problem":{"oneOf":[{"type":"string"},{"type":"object"}]}
                    }
                  }
                }
                """;
        JsonNode root = mapper.readTree(source);

        Map<String, String> files = generator.generate("contract", "contract-api", Map.of("public", bytes(source)));
        JsonNode operation = onlyContract(files, "/operations/");

        assertEquals(root.at("/paths/~1items~1{id}/patch"), operation.path("operation"));
        assertEquals(root.path("security"), operation.path("security"));
        assertEquals(root.at("/paths/~1items~1{id}/servers"), operation.path("servers"));
        assertEquals(2, operation.path("parameters").size());
        assertEquals("id", operation.path("parameters").get(0).path("name").asText());
        assertEquals("deepObject", operation.path("parameters").get(1).path("style").asText());
        assertTrue(operation.path("operation").path("requestBody").path("content").has("multipart/form-data"));
        assertTrue(operation.path("operation").path("responses").path("default").path("content").has("application/problem+json"));

        Set<JsonNode> renderedSchemas = contracts(files, "/schemas/");
        root.at("/components/schemas").fields().forEachRemaining(entry -> assertTrue(renderedSchemas.contains(entry.getValue())));
        assertTrue(contracts(files, "/refs/").contains(root.at("/components/parameters/Id")));
    }

    @Test
    void keepsConflictingNamesOwnedByDocumentAndService() throws Exception {
        String left = collidingDocument("string", "basic", "https://left.invalid");
        String right = collidingDocument("integer", "bearer", "https://right.invalid");
        var documents = new TreeMap<String, byte[]>();
        documents.put("left", bytes(left));
        documents.put("right", bytes(right));

        Map<String, String> first = generator.generate("service-one", "service-one-api", documents);

        JsonNode leftOperation = contract(first.entrySet().stream().filter(entry -> entry.getKey().contains("/left/operations/")).findFirst().orElseThrow().getValue());
        JsonNode rightOperation = contract(first.entrySet().stream().filter(entry -> entry.getKey().contains("/right/operations/")).findFirst().orElseThrow().getValue());
        assertEquals("service-one", leftOperation.path("serviceId").asText());
        assertEquals("left", leftOperation.path("documentId").asText());
        assertEquals("basic", leftOperation.at("/securitySchemes/auth/scheme").asText());
        assertEquals("right", rightOperation.path("documentId").asText());
        assertEquals("bearer", rightOperation.at("/securitySchemes/auth/scheme").asText());
        assertNotEquals(onlyContractForDocument(first, "left", "/schemas/"), onlyContractForDocument(first, "right", "/schemas/"));

        Map<String, String> second = generator.generate("service-two", "service-two-api", Map.of("left", bytes(left)));
        assertEquals("service-two", mapper.readTree(second.get("references/source.json")).path("serviceId").asText());
        assertEquals("service-one", mapper.readTree(first.get("references/source.json")).path("serviceId").asText());
    }

    @Test
    void keepsStablePathsAndReturnsACompleteImmutableResult() {
        String original = collidingDocument("string", "basic", "https://left.invalid");
        String edited = original.replace("\"title\":\"Collision\"", "\"title\":\"Edited collision\"");

        Map<String, String> first = generator.generate("service", "service-api", Map.of("public", bytes(original)));
        Map<String, String> second = generator.generate("service", "service-api", Map.of("public", bytes(edited)));

        assertEquals(first.keySet(), second.keySet());
        assertNotEquals(first.get("references/source.json"), second.get("references/source.json"));
        assertThrows(UnsupportedOperationException.class, () -> first.put("extra", "content"));
    }

    @Test
    void reportsTheFailingRequiredDocumentAndRejectsNullIdentity() {
        var documents = new TreeMap<String, byte[]>();
        documents.put("good", bytes(collidingDocument("string", "basic", "https://good.invalid")));
        documents.put("invalid", bytes("{"));
        var failure = assertThrows(IllegalArgumentException.class,
                () -> generator.generate("service", "service-api", documents));
        assertTrue(failure.getMessage().startsWith("invalid:"), failure.getMessage());

        var nullIdentity = new HashMap<String, byte[]>();
        nullIdentity.put(null, bytes(collidingDocument("string", "basic", "https://good.invalid")));
        var identityFailure = assertThrows(IllegalArgumentException.class,
                () -> generator.generate("service", "service-api", nullIdentity));
        assertTrue(identityFailure.getMessage().contains("IDENTITY"), identityFailure.getMessage());
    }

    private String collidingDocument(String type, String scheme, String server) {
        return """
                {"openapi":"3.1.0","info":{"title":"Collision","version":"1"},
                 "servers":[{"url":"%s"}],"paths":{"/same":{"get":{"operationId":"same","security":[{"auth":[]}],"responses":{"200":{"description":"ok","content":{"application/json":{"schema":{"$ref":"#/components/schemas/Same"}}}}}}}},
                 "components":{"schemas":{"Same":{"type":"%s"}},"securitySchemes":{"auth":{"type":"http","scheme":"%s"}}}}
                """.formatted(server, type, scheme);
    }

    private byte[] bytes(String source) {
        return source.getBytes(StandardCharsets.UTF_8);
    }

    private JsonNode onlyContract(Map<String, String> files, String directory) {
        return contracts(files, directory).stream().findFirst().orElseThrow();
    }

    private JsonNode onlyContractForDocument(Map<String, String> files, String document, String directory) {
        return files.entrySet().stream()
                .filter(entry -> entry.getKey().contains("/" + document + directory))
                .map(Map.Entry::getValue)
                .map(this::contract)
                .findFirst()
                .orElseThrow();
    }

    private Set<JsonNode> contracts(Map<String, String> files, String directory) {
        return files.entrySet().stream()
                .filter(entry -> entry.getKey().contains(directory))
                .map(Map.Entry::getValue)
                .map(this::contract)
                .collect(Collectors.toSet());
    }

    private JsonNode contract(String markdown) {
        try {
            int start = markdown.indexOf('\n', markdown.indexOf("```json")) + 1;
            return mapper.readTree(markdown.substring(start, markdown.indexOf("\n```", start)));
        } catch (Exception error) {
            throw new AssertionError(error);
        }
    }
}
