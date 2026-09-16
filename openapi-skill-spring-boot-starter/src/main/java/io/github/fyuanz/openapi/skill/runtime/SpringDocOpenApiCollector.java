package io.github.fyuanz.openapi.skill.runtime;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import org.springdoc.core.models.GroupedOpenApi;
import org.springdoc.core.properties.SpringDocConfigProperties;
import org.springdoc.webmvc.api.MultipleOpenApiWebMvcResource;
import org.springdoc.webmvc.api.OpenApiWebMvcResource;
import org.springframework.beans.factory.ObjectProvider;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Obtains the same complete JSON documents as SpringDoc's HTTP resources without an HTTP self-request. */
public final class SpringDocOpenApiCollector {
    private final ObjectProvider<OpenApiWebMvcResource> defaultResource;
    private final ObjectProvider<MultipleOpenApiWebMvcResource> groupedResource;
    private final ObjectProvider<GroupedOpenApi> groups;
    private final SpringDocConfigProperties springDocProperties;

    public SpringDocOpenApiCollector(ObjectProvider<OpenApiWebMvcResource> defaultResource,
                                     ObjectProvider<MultipleOpenApiWebMvcResource> groupedResource,
                                     ObjectProvider<GroupedOpenApi> groups,
                                     SpringDocConfigProperties springDocProperties) {
        this.defaultResource = defaultResource;
        this.groupedResource = groupedResource;
        this.groups = groups;
        this.springDocProperties = springDocProperties;
    }

    public Map<String, byte[]> collect(HttpServletRequest request, Locale locale) {
        String apiDocsPath = springDocProperties.getApiDocs().getPath();
        List<GroupedOpenApi> configuredGroups = groups.orderedStream()
                .sorted(Comparator.comparing(GroupedOpenApi::getGroup))
                .toList();
        try {
            if (configuredGroups.isEmpty()) {
                OpenApiWebMvcResource resource = defaultResource.getIfAvailable();
                if (resource == null) throw new IllegalStateException("SpringDoc default OpenAPI resource is unavailable");
                HttpServletRequest documentRequest = documentRequest(request, apiDocsPath);
                return Map.of("openapi", resource.openapiJson(documentRequest, apiDocsPath, locale));
            }
            MultipleOpenApiWebMvcResource resource = groupedResource.getIfAvailable();
            if (resource == null) throw new IllegalStateException("SpringDoc grouped OpenAPI resource is unavailable");
            Map<String, byte[]> documents = new LinkedHashMap<>();
            for (GroupTarget target : targets(configuredGroups)) {
                String documentPath = apiDocsPath + "/" + target.group();
                HttpServletRequest documentRequest = documentRequest(request, documentPath);
                documents.put(target.documentId(), resource.openapiJson(
                        documentRequest, apiDocsPath, target.group(), locale));
            }
            return Map.copyOf(documents);
        } catch (Exception error) {
            throw new IllegalStateException("Unable to obtain complete OpenAPI JSON from SpringDoc", error);
        }
    }

    private List<GroupTarget> targets(List<GroupedOpenApi> configuredGroups) {
        List<GroupTarget> targets = new ArrayList<>();
        Map<String, Integer> occurrences = new LinkedHashMap<>();
        var used = new LinkedHashSet<String>();
        for (GroupedOpenApi group : configuredGroups) {
            String base = RuntimeSkillNames.safe(group.getGroup());
            int occurrence = occurrences.merge(base, 1, Integer::sum);
            String id = occurrence == 1 ? base : suffixed(base, occurrence);
            while (!used.add(id)) id = suffixed(base, ++occurrence);
            occurrences.put(base, occurrence);
            targets.add(new GroupTarget(id, group.getGroup()));
        }
        return targets;
    }

    private String suffixed(String base, int occurrence) {
        String suffix = "-" + occurrence;
        int baseLength = Math.min(base.length(), 63 - suffix.length());
        return base.substring(0, baseLength).replaceAll("-+$", "") + suffix;
    }

    private HttpServletRequest documentRequest(HttpServletRequest request, String documentPath) {
        String requestUrl = request.getRequestURL().toString();
        String requestUri = request.getRequestURI();
        String origin = requestUrl.substring(0, requestUrl.length() - requestUri.length());
        String documentUri = request.getContextPath() + documentPath;
        return new DocumentRequest(request, origin + documentUri, documentUri, documentPath);
    }

    private record GroupTarget(String documentId, String group) {}

    private static final class DocumentRequest extends HttpServletRequestWrapper {
        private final String requestUrl;
        private final String requestUri;
        private final String servletPath;

        private DocumentRequest(HttpServletRequest request, String requestUrl, String requestUri, String servletPath) {
            super(request);
            this.requestUrl = requestUrl;
            this.requestUri = requestUri;
            this.servletPath = servletPath;
        }

        @Override
        public StringBuffer getRequestURL() {
            return new StringBuffer(requestUrl);
        }

        @Override
        public String getRequestURI() {
            return requestUri;
        }

        @Override
        public String getServletPath() {
            return servletPath;
        }

        @Override
        public String getPathInfo() {
            return null;
        }
    }
}
