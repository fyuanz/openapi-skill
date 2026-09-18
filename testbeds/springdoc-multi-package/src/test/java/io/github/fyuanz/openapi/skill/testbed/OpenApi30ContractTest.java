package io.github.fyuanz.openapi.skill.testbed;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.annotation.DirtiesContext;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The same producer and the same controllers under the OPENAPI_3_0 dialect. These documents are the evidence that
 * the older root marker is accepted on bytes a real generator emitted, not on a hand-written sample.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {"server.address=127.0.0.1", "springdoc.api-docs.version=OPENAPI_3_0"})
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@Timeout(60)
class OpenApi30ContractTest {
    @LocalServerPort
    int port;
    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    @Test
    void exportsTheSameDocumentSetUnderTheOlderRootMarker() throws Exception {
        JsonNode account = fetch("account");
        JsonNode business = fetch("business");

        // The producer selects the dialect and its exact patch; springdoc 2.8.15 emits 3.0.1, not 3.0.0.
        assertThat(account.path("openapi").asText()).matches("3\\.0\\.\\d+");
        assertThat(business.path("openapi").asText()).matches("3\\.0\\.\\d+");
        assertThat(paths(account)).containsExactlyInAnyOrder("/users", "/users/{id}");
        assertThat(paths(business)).containsExactlyInAnyOrder("/orders", "/files");

        // The contract facts the compiler depends on must survive the dialect switch.
        assertThat(account.at("/paths/~1users~1{id}/get/responses/404/content/application~1json/schema/$ref").asText())
                .isEqualTo("#/components/schemas/ApiError");
        assertThat(account.at("/components/schemas/UserView/properties/children/items/$ref").asText())
                .isEqualTo("#/components/schemas/UserView");
        assertThat(account.at("/components/securitySchemes/bearerAuth/type").asText()).isEqualTo("http");
        assertThat(business.at("/components/schemas/CreateOrder/required").toString())
                .contains("userId", "quantity", "shippingAddress");
        assertThat(business.at("/components/schemas/CreateOrder/properties/quantity/minimum").asInt()).isEqualTo(1);

        // A 3.0 producer discards siblings of $ref, so those descriptions never reach any consumer of this snapshot.
        assertThat(account.at("/components/schemas/UserView/properties/address/description").isMissingNode()).isTrue();
        assertThat(business.at("/components/schemas/CreateOrder/properties/shippingAddress/description").isMissingNode())
                .isTrue();

        // Export only after every assertion above passed. Snapshots are refreshed explicitly.
        Path output = Path.of("target", "openapi30");
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

    private Set<String> paths(JsonNode document) {
        Set<String> actual = new HashSet<>();
        document.path("paths").fieldNames().forEachRemaining(actual::add);
        return actual;
    }
}
