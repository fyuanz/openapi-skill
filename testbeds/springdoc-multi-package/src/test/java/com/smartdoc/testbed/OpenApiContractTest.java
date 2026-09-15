package com.smartdoc.testbed;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.annotation.DirtiesContext;

import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "server.address=127.0.0.1")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@Timeout(60)
class OpenApiContractTest {
    @LocalServerPort
    int port;
    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    @Test
    void servesSwaggerUiWithBothDocumentGroups() throws Exception {
        HttpResponse<String> entry = get("/swagger-ui.html");
        assertThat(entry.statusCode()).isEqualTo(302);
        assertThat(entry.headers().firstValue("location")).hasValue("/swagger-ui/index.html");
        HttpResponse<String> page = get("/swagger-ui/index.html");
        assertThat(page.statusCode()).isEqualTo(200);
        assertThat(page.body()).contains("swagger-ui-bundle.js");
        assertThat(get("/swagger-ui/swagger-ui-bundle.js").statusCode()).isEqualTo(200);
        HttpResponse<String> configResponse = get("/v3/api-docs/swagger-config");
        assertThat(configResponse.statusCode()).isEqualTo(200);
        JsonNode config = mapper.readTree(configResponse.body());
        Set<String> groups = new HashSet<>();
        for (JsonNode group : config.path("urls")) {
            groups.add(group.path("name").asText() + "=" + group.path("url").asText());
        }
        assertThat(groups).containsExactlyInAnyOrder(
                "account=/v3/api-docs/account", "business=/v3/api-docs/business");
    }

    @Test
    void downloadsRuntimeSkillZipFromTheCurrentGroupedOpenApi() throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create(
                        "http://127.0.0.1:" + port + "/smartdoc/skill.zip"))
                .timeout(Duration.ofSeconds(20)).GET().build();
        HttpResponse<byte[]> response = client.send(request, HttpResponse.BodyHandlers.ofByteArray());
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.headers().firstValue("content-type")).hasValue("application/zip");
        assertThat(response.headers().firstValue("content-disposition"))
                .hasValue("attachment; filename=springdoc-multi-package-api.zip");

        Map<String, String> files = unzip(response.body());
        String root = "springdoc-multi-package-api/";
        assertThat(files).containsKeys(root + "SKILL.md", root + "references/source.json",
                root + "references/operations.jsonl", root + "references/schemas.jsonl",
                root + "references/conventions.md");
        JsonNode source = mapper.readTree(files.get(root + "references/source.json"));
        assertThat(source.path("documents").findValuesAsText("documentId"))
                .containsExactly("account", "business");
        assertThat(files.get(root + "references/operations.jsonl"))
                .contains("\"method\":\"GET\"", "\"path\":\"/users\"",
                        "\"method\":\"POST\"", "\"path\":\"/orders\"", "\"path\":\"/files\"")
                .doesNotContain("/smartdoc/skill.zip");
    }

    private HttpResponse<String> get(String path) throws Exception {
        return client.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path))
                .timeout(Duration.ofSeconds(20)).GET().build(), HttpResponse.BodyHandlers.ofString());
    }

    private Map<String, String> unzip(byte[] archive) throws Exception {
        Map<String, String> files = new HashMap<>();
        try (ZipInputStream input = new ZipInputStream(new ByteArrayInputStream(archive), StandardCharsets.UTF_8)) {
            for (ZipEntry entry; (entry = input.getNextEntry()) != null; ) {
                files.put(entry.getName(), new String(input.readAllBytes(), StandardCharsets.UTF_8));
            }
        }
        return files;
    }

    @Test
    void exportsCompleteValidatedDocumentSet() throws Exception {
        JsonNode account = fetch("account");
        JsonNode business = fetch("business");
        checkDocument(account, Set.of("/users", "/users/{id}"));
        checkDocument(business, Set.of("/orders", "/files"));
        JsonNode getUser = account.at("/paths/~1users~1{id}/get");
        assertThat(getUser.path("summary").asText()).isEqualTo("查询用户");
        assertThat(getUser.path("tags").toString()).contains("用户管理");
        assertParameter(getUser, "id", "path", true);
        assertParameter(getUser, "X-Request-Id", "header", false);
        assertParameter(account.at("/paths/~1users/get"), "keyword", "query", false);
        assertThat(getUser.at("/responses/404/content/application~1json/schema/$ref").asText())
                .isEqualTo("#/components/schemas/ApiError");
        assertThat(getUser.at("/responses/200/content/application~1json/schema/$ref").asText())
                .isEqualTo("#/components/schemas/UserView");
        assertThat(account.at("/components/schemas/UserView/properties/name/description").asText())
                .isEqualTo("用户显示名称");
        assertThat(account.at("/components/schemas/UserView/properties/address/$ref").asText())
                .isEqualTo("#/components/schemas/Address");
        assertThat(account.at("/components/schemas/UserView/properties/children/items/$ref").asText())
                .isEqualTo("#/components/schemas/UserView");
        JsonNode order = business.at("/paths/~1orders/post");
        assertThat(order.at("/requestBody/required").asBoolean()).isTrue();
        assertThat(order.at("/requestBody/content/application~1json/schema/$ref").asText())
                .isEqualTo("#/components/schemas/CreateOrder");
        assertThat(business.at("/components/schemas/CreateOrder/required").toString())
                .contains("userId", "quantity", "shippingAddress");
        assertThat(business.at("/components/schemas/CreateOrder/properties/quantity/minimum").asInt()).isEqualTo(1);
        assertThat(business.at("/components/schemas/CreateOrder/properties/shippingAddress/$ref").asText())
                .isEqualTo("#/components/schemas/Address");
        assertThat(order.at("/responses/201/description").asText()).isEqualTo("订单已创建");
        assertThat(order.at("/responses/400/content/application~1json/schema/$ref").asText())
                .isEqualTo("#/components/schemas/ApiError");
        assertThat(order.at("/security/0").has("bearerAuth")).isTrue();
        JsonNode multipart = business.at("/paths/~1files/post/requestBody/content/multipart~1form-data/schema");
        if (multipart.has("$ref")) multipart = business.at(multipart.path("$ref").asText().substring(1));
        assertThat(multipart.at("/properties/file/format").asText()).isEqualTo("binary");
        assertThat(multipart.path("required").toString()).contains("file");

        // Export only after BOTH groups pass. Source snapshots are refreshed explicitly.
        Path output = Path.of("target", "openapi");
        Files.createDirectories(output);
        Files.write(output.resolve("account.json"), mapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(account));
        Files.write(output.resolve("business.json"), mapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(business));
    }

    private JsonNode fetch(String group) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/v3/api-docs/" + group))
                .timeout(Duration.ofSeconds(20)).GET().build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).as("document group %s", group).isEqualTo(200);
        return mapper.readTree(response.body());
    }

    private void checkDocument(JsonNode document, Set<String> paths) {
        assertThat(document.path("openapi").asText()).isEqualTo("3.1.0");
        Set<String> actual = new HashSet<>();
        document.path("paths").fieldNames().forEachRemaining(actual::add);
        assertThat(actual).isEqualTo(paths);
        assertThat(document.at("/components/securitySchemes/bearerAuth/type").asText()).isEqualTo("http");
        assertThat(document.at("/components/securitySchemes/bearerAuth/scheme").asText()).isEqualTo("bearer");
        checkReferences(document, document);
    }

    private void checkReferences(JsonNode root, JsonNode node) {
        if (node.isObject() && node.has("$ref")) {
            String ref = node.path("$ref").asText();
            assertThat(ref).startsWith("#/");
            assertThat(root.at(ref.substring(1)).isMissingNode()).as("reference %s", ref).isFalse();
        }
        node.forEach(child -> checkReferences(root, child));
    }

    private void assertParameter(JsonNode operation, String name, String location, boolean required) {
        JsonNode parameter = null;
        for (JsonNode candidate : operation.path("parameters")) {
            if (candidate.path("name").asText().equals(name)) parameter = candidate;
        }
        assertThat(parameter).as("parameter %s", name).isNotNull();
        assertThat(parameter.path("in").asText()).isEqualTo(location);
        assertThat(parameter.path("required").asBoolean()).isEqualTo(required);
        assertThat(parameter.path("description").asText()).isNotBlank();
    }
}
