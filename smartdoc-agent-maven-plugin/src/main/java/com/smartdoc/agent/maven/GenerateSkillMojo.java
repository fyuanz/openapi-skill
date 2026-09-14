package com.smartdoc.agent.maven;

import com.smartdoc.agent.core.ServiceSkillUpdater;
import com.smartdoc.agent.core.SkillGenerator;
import org.apache.maven.execution.MavenSession;
import org.apache.maven.plugin.AbstractMojo;
import org.apache.maven.plugins.annotations.Mojo;
import org.apache.maven.plugins.annotations.Parameter;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.attribute.BasicFileAttributes;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;

/** Generates and safely publishes one service Skill from configured local documents. */
@Mojo(name = "generate-skill", threadSafe = true)
public final class GenerateSkillMojo extends AbstractMojo {
    @Parameter(defaultValue = "service")
    String outputMode = "service";

    @Parameter
    String aggregateId;

    @Parameter
    String aggregateSkillName;

    @Parameter
    List<ServiceSource> services;

    @Parameter
    String serviceId;

    @Parameter
    String skillName;

    @Parameter(defaultValue = "${project.build.directory}/generated-resources/smartdoc")
    File outputDirectory;

    @Parameter(defaultValue = "30")
    long timeoutSeconds;

    @Parameter(defaultValue = "false")
    boolean requireCurrentBuildDocuments;

    @Parameter(defaultValue = "${session}", readonly = true)
    MavenSession session;

    @Parameter
    List<DocumentSource> documents;

    @Parameter
    File documentsDirectory;

    @Override
    public void execute() {
        String service = serviceId == null || serviceId.isBlank() ? "<unconfigured>" : serviceId;
        try {
            if (!List.of("service", "aggregate", "both").contains(outputMode))
                throw new IllegalArgumentException("CONFIG: outputMode must be service, aggregate or both");
            if (services != null) {
                new MultiServiceGeneration(this).execute();
                return;
            }
            if (!"service".equals(outputMode) || aggregateId != null || aggregateSkillName != null)
                throw new IllegalArgumentException("CONFIG: aggregate output requires an explicit services list");
            validateConfiguration();
            List<DocumentSource> configuredDocuments = resolveDocuments();
            if (configuredDocuments.isEmpty()) {
                getLog().info("SmartDoc [" + serviceId + "] SKIPPED: no OpenAPI JSON files found in "
                        + documentsDirectory.toPath().toAbsolutePath().normalize());
                return;
            }
            Instant currentBuildStartedAt = currentBuildStartedAt();
            var result = new ServiceSkillUpdater().update(serviceId, skillName, outputDirectory.toPath(),
                    Duration.ofSeconds(timeoutSeconds),
                    () -> new SkillGenerator().generate(serviceId, skillName,
                            readDocuments(configuredDocuments, currentBuildStartedAt)));
            String summary = "SmartDoc [" + serviceId + "] " + result.outcome() + ": " + result.message()
                    + "; Skill=" + result.skillDirectory();
            if (result.outcome() == ServiceSkillUpdater.Outcome.SUCCESS) getLog().info(summary);
            else getLog().warn(summary);
        } catch (Exception error) {
            String detail = error.getMessage() == null || error.getMessage().isBlank()
                    ? error.getClass().getSimpleName() : error.getMessage();
            if (!detail.startsWith("CONFIG:")) detail = "CONFIG: " + detail;
            getLog().warn("SmartDoc [" + service + "] FAILED: " + detail);
            getLog().debug("SmartDoc update failure", error);
        }
    }

    private void validateConfiguration() {
        if (serviceId == null || serviceId.isBlank()) throw new IllegalArgumentException("CONFIG: serviceId is required");
        if (skillName == null || skillName.isBlank()) throw new IllegalArgumentException("CONFIG: skillName is required");
        if (outputDirectory == null) throw new IllegalArgumentException("CONFIG: outputDirectory is required");
        if (timeoutSeconds <= 0) throw new IllegalArgumentException("CONFIG: timeoutSeconds must be positive");
        boolean hasDocuments = documents != null && !documents.isEmpty();
        if (hasDocuments && documentsDirectory != null)
            throw new IllegalArgumentException("CONFIG: configure documents or documentsDirectory, not both");
        if (!hasDocuments && documentsDirectory == null)
            throw new IllegalArgumentException("CONFIG: documents or documentsDirectory is required");
    }

    private List<DocumentSource> resolveDocuments() throws Exception {
        return resolveDocuments(documents, documentsDirectory);
    }

    private List<DocumentSource> resolveDocuments(List<DocumentSource> sources, File directoryFile) throws Exception {
        boolean explicit = sources != null && !sources.isEmpty();
        if (explicit == (directoryFile != null))
            throw new IllegalArgumentException("CONFIG: configure documents or documentsDirectory, not both");
        if (explicit) return List.copyOf(sources);
        var directory = directoryFile.toPath().toAbsolutePath().normalize();
        if (!Files.exists(directory)) return List.of();
        if (!Files.isDirectory(directory))
            throw new IllegalArgumentException("CONFIG: documentsDirectory is not a directory: " + directory);
        try (var paths = Files.list(directory)) {
            return paths.filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().toLowerCase(Locale.ROOT).endsWith(".json"))
                    .sorted(Comparator.comparing(path -> path.getFileName().toString()))
                    .map(this::discoveredDocument)
                    .toList();
        }
    }

    private DocumentSource discoveredDocument(java.nio.file.Path path) {
        String name = path.getFileName().toString();
        String id = name.substring(0, name.length() - ".json".length());
        if (!id.matches("[a-z0-9]+(?:-[a-z0-9]+)*") || id.length() > 63)
            throw new IllegalArgumentException("CONFIG: discovered JSON filename must be a safe lowercase document id: "
                    + name);
        var source = new DocumentSource();
        source.setId(id);
        source.setPath(path.toFile());
        return source;
    }

    Instant currentBuildStartedAt() {
        if (!requireCurrentBuildDocuments) return null;
        if (session == null || session.getRequest() == null || session.getRequest().getStartTime() == null)
            throw new IllegalArgumentException("CONFIG: current Maven session start time is unavailable");
        return session.getRequest().getStartTime().toInstant();
    }

    Map<String, String> generateMember(ServiceSource source, Instant startedAt) throws Exception {
        var inputs = resolveDocuments(source.getDocuments(), source.getDocumentsDirectory());
        if (inputs.isEmpty()) throw new IllegalArgumentException("INPUT: required service has no OpenAPI JSON documents");
        return new SkillGenerator().generate(source.getServiceId(), source.getSkillName(), readDocuments(inputs, startedAt));
    }

    private Map<String, byte[]> readDocuments(List<DocumentSource> configuredDocuments,
                                               Instant currentBuildStartedAt) throws Exception {
        var result = new TreeMap<String, byte[]>();
        for (DocumentSource document : configuredDocuments) {
            if (document == null || document.getId() == null || document.getId().isBlank())
                throw new IllegalArgumentException("CONFIG: every document requires an id");
            if (document.getPath() == null)
                throw new IllegalArgumentException(document.getId() + ": CONFIG: document path is required");
            if (result.containsKey(document.getId()))
                throw new IllegalArgumentException(document.getId() + ": CONFIG: duplicate document id");
            var path = document.getPath().toPath().toAbsolutePath().normalize();
            if (!Files.isRegularFile(path))
                throw new IllegalArgumentException(document.getId() + ": INPUT: configured document is unavailable at " + path);
            BasicFileAttributes before = Files.readAttributes(path, BasicFileAttributes.class);
            if (currentBuildStartedAt != null
                    && before.lastModifiedTime().toInstant().isBefore(currentBuildStartedAt))
                throw new IllegalArgumentException(document.getId()
                        + ": INPUT: document was not prepared during the current Maven build at " + path);
            byte[] bytes = Files.readAllBytes(path);
            BasicFileAttributes after = Files.readAttributes(path, BasicFileAttributes.class);
            if (before.size() != after.size() || !before.lastModifiedTime().equals(after.lastModifiedTime()))
                throw new IllegalArgumentException(document.getId() + ": INPUT: document changed while being read at " + path);
            result.put(document.getId(), bytes);
        }
        return result;
    }
}
