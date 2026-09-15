package com.smartdoc.agent.runtime;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springdoc.core.models.GroupedOpenApi;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = RuntimeSkillEndpointTest.Application.class, properties = {
        "spring.application.name=Orders Service",
        "springdoc.api-docs.version=OPENAPI_3_1"
})
@AutoConfigureMockMvc
class RuntimeSkillEndpointTest {
    @Autowired
    MockMvc mvc;
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void discoversSpringDocGroupsAndDownloadsCurrentSkillZipWithoutBuildConfiguration() throws Exception {
        byte[] first = mvc.perform(get("/smartdoc/skill.zip"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, "application/zip"))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=orders-service-api.zip"))
                .andReturn().getResponse().getContentAsByteArray();
        byte[] second = mvc.perform(get("/smartdoc/skill.zip"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();

        assertThat(second).isEqualTo(first);
        Map<String, String> files = unzip(first);
        assertThat(files).containsKeys(
                "orders-service-api/SKILL.md",
                "orders-service-api/references/source.json",
                "orders-service-api/references/catalog.md",
                "orders-service-api/references/operations.jsonl",
                "orders-service-api/references/schemas.jsonl",
                "orders-service-api/references/conventions.md");
        JsonNode source = mapper.readTree(files.get("orders-service-api/references/source.json"));
        assertThat(source.path("serviceId").asText()).isEqualTo("orders-service");
        assertThat(source.path("skillName").asText()).isEqualTo("orders-service-api");
        assertThat(source.path("documents").findValuesAsText("documentId"))
                .containsExactly("account", "business");
        assertThat(files.get("orders-service-api/references/operations.jsonl"))
                .contains("\"method\":\"GET\"", "\"path\":\"/users/{id}\"",
                        "\"method\":\"POST\"", "\"path\":\"/orders\"")
                .doesNotContain("/smartdoc/skill.zip");
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

    @SpringBootConfiguration
    @EnableAutoConfiguration
    static class Application {
        @Bean
        GroupedOpenApi accountApi() {
            return GroupedOpenApi.builder().group("account").pathsToMatch("/users/**").build();
        }

        @Bean
        GroupedOpenApi businessApi() {
            return GroupedOpenApi.builder().group("business").pathsToMatch("/orders/**").build();
        }

        @Bean
        TestApi testApi() {
            return new TestApi();
        }
    }

    @RestController
    static class TestApi {
        @GetMapping("/users/{id}")
        String user() {
            return "user";
        }

        @PostMapping("/orders")
        String order() {
            return "order";
        }
    }
}
