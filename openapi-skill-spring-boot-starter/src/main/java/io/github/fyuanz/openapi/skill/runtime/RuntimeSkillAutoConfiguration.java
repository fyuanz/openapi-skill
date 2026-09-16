package io.github.fyuanz.openapi.skill.runtime;

import org.springdoc.core.models.GroupedOpenApi;
import org.springdoc.core.properties.SpringDocConfigProperties;
import org.springdoc.webmvc.api.MultipleOpenApiWebMvcResource;
import org.springdoc.webmvc.api.OpenApiWebMvcResource;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.core.env.Environment;
import org.springframework.web.servlet.DispatcherServlet;

/** Auto-configures runtime Skill download for servlet applications using SpringDoc. */
@AutoConfiguration
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
@ConditionalOnClass({DispatcherServlet.class, OpenApiWebMvcResource.class})
@ConditionalOnProperty(prefix = "openapi.skill.runtime", name = "enabled", matchIfMissing = true)
@EnableConfigurationProperties(RuntimeSkillProperties.class)
public class RuntimeSkillAutoConfiguration {
    @Bean
    @ConditionalOnMissingBean
    SpringDocOpenApiCollector smartDocOpenApiCollector(
            ObjectProvider<OpenApiWebMvcResource> defaultResource,
            ObjectProvider<MultipleOpenApiWebMvcResource> groupedResource,
            ObjectProvider<GroupedOpenApi> groups,
            SpringDocConfigProperties springDocProperties) {
        return new SpringDocOpenApiCollector(defaultResource, groupedResource, groups, springDocProperties);
    }

    @Bean
    @ConditionalOnMissingBean
    RuntimeSkillArchive smartDocRuntimeSkillArchive(SpringDocOpenApiCollector collector,
                                                     RuntimeSkillProperties properties,
                                                     Environment environment) {
        return new RuntimeSkillArchive(collector, properties, environment);
    }

    @Bean
    @ConditionalOnMissingBean
    RuntimeSkillEndpoint smartDocRuntimeSkillEndpoint(RuntimeSkillArchive archive) {
        return new RuntimeSkillEndpoint(archive);
    }
}
