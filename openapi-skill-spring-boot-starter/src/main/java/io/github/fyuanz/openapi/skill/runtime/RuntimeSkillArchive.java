package io.github.fyuanz.openapi.skill.runtime;

import io.github.fyuanz.openapi.skill.core.SkillGenerator;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.env.Environment;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/** Generates a current, deterministic, directly installable Skill ZIP in memory. */
public final class RuntimeSkillArchive {
    private final SpringDocOpenApiCollector collector;
    private final RuntimeSkillProperties properties;
    private final Environment environment;
    private final SkillGenerator generator = new SkillGenerator();

    public RuntimeSkillArchive(SpringDocOpenApiCollector collector, RuntimeSkillProperties properties,
                               Environment environment) {
        this.collector = collector;
        this.properties = properties;
        this.environment = environment;
    }

    public Archive generate(HttpServletRequest request, Locale locale) {
        RuntimeSkillNames.Names names = RuntimeSkillNames.resolve(properties, environment);
        Map<String, byte[]> documents = collector.collect(request, locale);
        Map<String, String> files = generator.generate(names.serviceId(), names.skillName(), documents);
        return new Archive(names.skillName() + ".zip", zip(names.skillName(), files));
    }

    private byte[] zip(String root, Map<String, String> files) {
        try {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            try (ZipOutputStream output = new ZipOutputStream(bytes, StandardCharsets.UTF_8)) {
                for (Map.Entry<String, String> file : new TreeMap<>(files).entrySet()) {
                    ZipEntry entry = new ZipEntry(root + "/" + file.getKey());
                    entry.setTime(0L);
                    output.putNextEntry(entry);
                    output.write(file.getValue().getBytes(StandardCharsets.UTF_8));
                    output.closeEntry();
                }
            }
            return bytes.toByteArray();
        } catch (IOException error) {
            throw new IllegalStateException("Unable to create Skill ZIP", error);
        }
    }

    public record Archive(String fileName, byte[] content) {
        public Archive {
            content = content.clone();
        }

        @Override
        public byte[] content() {
            return content.clone();
        }
    }
}
