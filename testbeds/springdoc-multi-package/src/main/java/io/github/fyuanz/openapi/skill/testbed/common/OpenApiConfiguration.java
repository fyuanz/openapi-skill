package io.github.fyuanz.openapi.skill.testbed.common;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springdoc.core.models.GroupedOpenApi;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfiguration {
    @Bean
    OpenAPI sampleApi() {
        return new OpenAPI().info(new Info().title("OpenAPI Skill 多包测试服务").version("1.0.0")
                        .description("仅用于文档契约验证；全部数据为虚构样例，Bearer 定义仅演示文档元数据。"))
                .addServersItem(new Server().url("http://127.0.0.1:18080").description("本地测试服务默认地址"))
                .components(new Components().addSecuritySchemes("bearerAuth", new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")));
    }

    @Bean
    GroupedOpenApi accountApi() {
        return GroupedOpenApi.builder().group("account").packagesToScan("io.github.fyuanz.openapi.skill.testbed.user").build();
    }

    @Bean
    GroupedOpenApi businessApi() {
        return GroupedOpenApi.builder().group("business")
                .packagesToScan("io.github.fyuanz.openapi.skill.testbed.order", "io.github.fyuanz.openapi.skill.testbed.file").build();
    }
}
