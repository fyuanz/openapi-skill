package com.smartdoc.agent.runtime;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Bean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = RuntimeSkillSingleDocumentTest.Application.class, properties = {
        "springdoc.api-docs.version=OPENAPI_3_1",
        "smartdoc.runtime.path=/internal/api-skill.zip",
        "smartdoc.runtime.service-id=custom-service",
        "smartdoc.runtime.skill-name=custom-skill"
})
@AutoConfigureMockMvc
class RuntimeSkillSingleDocumentTest {
    @Autowired
    MockMvc mvc;

    @Test
    void usesDefaultDocumentAndOptionalEndpointAndIdentityOverrides() throws Exception {
        byte[] archive = mvc.perform(get("/internal/api-skill.zip"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();
        Map<String, String> files = unzip(archive);
        JsonNode source = new ObjectMapper().readTree(files.get("custom-skill/references/source.json"));
        assertThat(source.path("serviceId").asText()).isEqualTo("custom-service");
        assertThat(source.path("documents").path(0).path("documentId").asText()).isEqualTo("openapi");
        assertThat(files.get("custom-skill/references/catalog.md"))
                .contains("GET /status")
                .doesNotContain("/internal/api-skill.zip");
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
        StatusApi statusApi() {
            return new StatusApi();
        }
    }

    @RestController
    static class StatusApi {
        @GetMapping("/status")
        String status() {
            return "ok";
        }
    }
}
