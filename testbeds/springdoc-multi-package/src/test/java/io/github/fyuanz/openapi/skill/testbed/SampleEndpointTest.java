package io.github.fyuanz.openapi.skill.testbed;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class SampleEndpointTest {
    @Autowired
    MockMvc mvc;

    @Test
    void queriesSanitizedUserAndReportsMissingUser() throws Exception {
        mvc.perform(get("/users/1")).andExpect(status().isOk()).andExpect(jsonPath("$.name").value("示例用户"));
        mvc.perform(get("/users/99")).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
        mvc.perform(get("/users").param("keyword", "不存在")).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void validatesJsonBeforeCreatingSampleOrder() throws Exception {
        mvc.perform(post("/orders").contentType("application/json").content("""
                {"userId":1,"quantity":2,"shippingAddress":{"city":"示例市","street":"示例路"}}
                """)).andExpect(status().isCreated()).andExpect(jsonPath("$.quantity").value(2));
        mvc.perform(post("/orders").contentType("application/json").content("""
                {"userId":1,"quantity":0,"shippingAddress":{"city":"","street":"示例路"}}
                """)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void acceptsMultipartWithoutPersistingFiles() throws Exception {
        mvc.perform(multipart("/files").file(new MockMultipartFile("file", "sample.txt", "text/plain", new byte[]{1,2,3})))
                .andExpect(status().isOk()).andExpect(jsonPath("$.size").value(3));
    }
}
