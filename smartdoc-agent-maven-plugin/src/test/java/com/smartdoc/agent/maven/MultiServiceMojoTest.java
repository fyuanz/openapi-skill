package com.smartdoc.agent.maven;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.maven.execution.DefaultMavenExecutionRequest;
import org.apache.maven.execution.DefaultMavenExecutionResult;
import org.apache.maven.execution.MavenSession;
import org.apache.maven.plugin.logging.SystemStreamLog;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import static org.junit.jupiter.api.Assertions.*;

class MultiServiceMojoTest {
    @TempDir Path temporary;
    private final ObjectMapper mapper = new ObjectMapper();

    @Test void allOutputModesCreateOnlyTheirSelectedArtifacts() throws Exception {
        for (String mode : List.of("service", "aggregate", "both")) {
            var mojo = mojo(mode, mode);
            mojo.execute();
            assertEquals(!mode.equals("aggregate"), Files.exists(output(mode, "orders-api/SKILL.md")), mode);
            assertEquals(!mode.equals("aggregate"), Files.exists(output(mode, "billing-api/SKILL.md")), mode);
            assertEquals(!mode.equals("service"), Files.exists(output(mode, "platform-api/SKILL.md")), mode);
            if (!mode.equals("service")) {
                assertEquals(2, mapper.readTree(Files.readString(output(mode, "platform-api/references/source.json")))
                        .path("services").size());
            }
        }
    }

    @Test void badServiceRetainsAggregateAndItsOldSkillWhileValidPeerUpdates() throws Exception {
        var mojo = mojo("both", "out");
        mojo.execute();
        var aggregate = tree(output("out", "platform-api"));
        var billing = tree(output("out", "billing-api"));
        Files.writeString(input("orders"), document("/new-orders"));
        Files.writeString(input("billing"), "invalid");
        assertDoesNotThrow(mojo::execute);
        assertEquals(aggregate, tree(output("out", "platform-api")));
        assertEquals(billing, tree(output("out", "billing-api")));
        assertTrue(Files.readString(output("out", "orders-api/references/catalog.md")).contains("/new-orders"));
        assertEquals("FAILED", status("out", "platform"));
        assertEquals("FAILED", status("out", "billing"));
        assertEquals("SUCCESS", status("out", "orders"));
    }

    @Test void emptyRequiredServiceCannotPublishAPartialAggregate() throws Exception {
        var mojo = mojo("both", "out");
        mojo.execute();
        var previous = tree(output("out", "platform-api"));
        Files.delete(input("billing"));
        mojo.execute();
        assertEquals(previous, tree(output("out", "platform-api")));
        assertEquals("FAILED", status("out", "platform"));
        assertEquals("FAILED", status("out", "billing"));
    }

    @Test void aggregateOnlyHonorsCurrentBuildFreshnessAndPreservesOldOutput() throws Exception {
        var mojo = mojo("aggregate", "out");
        mojo.execute();
        var previous = tree(output("out", "platform-api"));
        Instant startedAt = Instant.now();
        Files.setLastModifiedTime(input("billing"), FileTime.from(startedAt.minusSeconds(10)));
        Files.setLastModifiedTime(input("orders"), FileTime.from(startedAt.plusMillis(100)));
        mojo.requireCurrentBuildDocuments = true;
        var request = new DefaultMavenExecutionRequest().setStartTime(Date.from(startedAt));
        mojo.session = new MavenSession(null, null, request, new DefaultMavenExecutionResult());
        mojo.execute();
        assertEquals(previous, tree(output("out", "platform-api")));
        assertEquals("FAILED", status("out", "platform"));
        assertFalse(Files.exists(output("out", "orders-api")));
    }

    @Test void rejectsModeIdentityAndOutputConflictsBeforeAnyPublication() throws Exception {
        for (String error : List.of("mode", "owner", "output", "duplicate", "mixed", "aggregate-owner", "aggregate-output")) {
            var mojo = mojo("both", error);
            switch (error) {
                case "mode" -> mojo.outputMode = "typo";
                case "owner" -> mojo.services.get(0).setServiceId("../unsafe");
                case "output" -> mojo.services.get(0).setSkillName("billing-api");
                case "duplicate" -> mojo.services.get(0).setServiceId("billing");
                case "mixed" -> mojo.serviceId = "legacy";
                case "aggregate-owner" -> mojo.aggregateId = "orders";
                case "aggregate-output" -> mojo.aggregateSkillName = "orders-api";
            }
            assertDoesNotThrow(mojo::execute);
            assertFalse(Files.exists(output(error, "orders-api")), error);
            assertFalse(Files.exists(output(error, "billing-api")), error);
            assertFalse(Files.exists(output(error, "platform-api")), error);
            assertFalse(((RecordingLog) mojo.getLog()).warnings.isEmpty(), error);
        }
    }

    @Test void removingAMemberCleansAggregateButDoesNotDeleteItsStandaloneSkill() throws Exception {
        var mojo = mojo("both", "out");
        mojo.execute();
        var billing = tree(output("out", "billing-api"));
        mojo.services = List.of(mojo.services.get(0));
        mojo.execute();
        assertFalse(Files.exists(output("out", "platform-api/references/services/billing")));
        assertEquals(billing, tree(output("out", "billing-api")));
    }

    @Test void aggregateOutputFailureDoesNotUndoServiceUpdates() throws Exception {
        var mojo = mojo("both", "out");
        Files.createDirectories(output("out", "platform-api"));
        Files.writeString(output("out", "platform-api/manual.txt"), "keep");
        mojo.execute();
        assertEquals("SUCCESS", status("out", "orders"));
        assertEquals("SUCCESS", status("out", "billing"));
        assertEquals("FAILED", status("out", "platform"));
        assertEquals("keep", Files.readString(output("out", "platform-api/manual.txt")));
    }

    private GenerateSkillMojo mojo(String mode, String folder) throws Exception {
        var mojo = new GenerateSkillMojo();
        mojo.setLog(new RecordingLog());
        mojo.outputMode = mode;
        mojo.aggregateId = "platform";
        mojo.aggregateSkillName = "platform-api";
        mojo.outputDirectory = temporary.resolve(folder).toFile();
        mojo.timeoutSeconds = 2;
        var services = new ArrayList<ServiceSource>();
        for (String id : List.of("orders", "billing")) {
            Files.createDirectories(input(id).getParent());
            Files.writeString(input(id), document("/users"));
            var service = new ServiceSource();
            service.setServiceId(id);
            service.setSkillName(id + "-api");
            service.setDocumentsDirectory(input(id).getParent().toFile());
            services.add(service);
        }
        mojo.services = services;
        return mojo;
    }

    private Path input(String id) { return temporary.resolve("input/" + id + "/common.json"); }
    private Path output(String folder, String path) { return temporary.resolve(folder).resolve(path); }
    private String status(String folder, String id) throws Exception {
        return mapper.readTree(Files.readString(output(folder, ".smartdoc/status/" + id + ".json")))
                .path("outcome").asText();
    }
    private Map<String, String> tree(Path path) throws Exception {
        var result = new TreeMap<String, String>();
        try (var files = Files.walk(path)) {
            for (var file : files.filter(Files::isRegularFile).toList()) result.put(path.relativize(file).toString(), Files.readString(file));
        }
        return result;
    }
    private String document(String path) {
        return """
                {"openapi":"3.1.0","paths":{"%s":{"get":{"responses":{"200":{"description":"ok"}}}}}}
                """.formatted(path);
    }
    private static class RecordingLog extends SystemStreamLog {
        final List<String> warnings = new ArrayList<>();
        @Override public void warn(CharSequence content) { warnings.add(content.toString()); }
        @Override public void info(CharSequence content) { }
        @Override public void debug(CharSequence content, Throwable error) { }
    }
}
