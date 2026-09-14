package com.smartdoc.agent.maven;

import com.smartdoc.agent.core.AggregateSkillGenerator;
import com.smartdoc.agent.core.ServiceSkillUpdater;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.Callable;
import java.util.concurrent.atomic.AtomicReference;

/** Coordinates explicit members without inferring reactor readiness or reading old generated Skills. */
final class MultiServiceGeneration {
    private final GenerateSkillMojo mojo;

    MultiServiceGeneration(GenerateSkillMojo mojo) { this.mojo = mojo; }

    void execute() {
        validate();
        Instant startedAt = mojo.currentBuildStartedAt();
        var members = mojo.services.stream().sorted(Comparator.comparing(ServiceSource::getServiceId)).toList();
        if (mojo.outputMode.equals("aggregate")) {
            // The updater bounds the entire read/convert/assemble task. Only its caller can publish.
            publish(mojo.aggregateId, mojo.aggregateSkillName, () -> {
                var prepared = new TreeMap<String, Map<String, String>>();
                for (ServiceSource member : members) {
                    try {
                        prepared.put(member.getServiceId(), mojo.generateMember(member, startedAt));
                        checkAggregateBudget(prepared);
                    } catch (Exception error) {
                        throw new IllegalArgumentException(member.getServiceId() + ": " + error.getMessage(), error);
                    }
                }
                return new AggregateSkillGenerator().generate(mojo.aggregateId, mojo.aggregateSkillName, prepared);
            });
            return;
        }

        var prepared = new TreeMap<String, Map<String, String>>();
        var failures = new ArrayList<String>();
        boolean aggregate = mojo.outputMode.equals("both");
        for (ServiceSource member : members) {
            var captured = new AtomicReference<Map<String, String>>();
            var result = publish(member.getServiceId(), member.getSkillName(), () -> {
                var files = mojo.generateMember(member, startedAt);
                captured.set(files);
                return files;
            });
            if (!aggregate) continue;
            if (result.outcome() != ServiceSkillUpdater.Outcome.SUCCESS) {
                failures.add(member.getServiceId() + ": " + result.outcome() + ": " + result.message());
                prepared.clear();
            } else if (failures.isEmpty()) {
                // Capture only successful bounded attempts. A late timed-out task cannot enter this set.
                prepared.put(member.getServiceId(), captured.get());
                try { checkAggregateBudget(prepared); }
                catch (IllegalArgumentException error) {
                    failures.add(error.getMessage());
                    prepared.clear();
                }
            }
        }
        if (aggregate) publish(mojo.aggregateId, mojo.aggregateSkillName, () -> {
            if (!failures.isEmpty()) throw new IllegalArgumentException("AGGREGATE: required service updates unavailable: "
                    + String.join("; ", failures));
            return new AggregateSkillGenerator().generate(mojo.aggregateId, mojo.aggregateSkillName, prepared);
        });
    }

    private ServiceSkillUpdater.UpdateResult publish(String id, String name, Callable<Map<String, String>> generation) {
        var result = new ServiceSkillUpdater().update(id, name, mojo.outputDirectory.toPath(),
                Duration.ofSeconds(mojo.timeoutSeconds), generation);
        String message = "SmartDoc [" + id + "] " + result.outcome() + ": " + result.message() + "; Skill=" + result.skillDirectory();
        if (result.outcome() == ServiceSkillUpdater.Outcome.SUCCESS) mojo.getLog().info(message);
        else mojo.getLog().warn(message);
        return result;
    }

    private void validate() {
        if (mojo.serviceId != null || mojo.skillName != null || mojo.documents != null || mojo.documentsDirectory != null)
            throw new IllegalArgumentException("CONFIG: services cannot be combined with top-level single-service parameters");
        if (mojo.outputDirectory == null || mojo.timeoutSeconds <= 0)
            throw new IllegalArgumentException("CONFIG: outputDirectory and a positive timeoutSeconds are required");
        if (mojo.services.isEmpty() || mojo.services.size() > 32)
            throw new IllegalArgumentException("CONFIG: services must contain 1 to 32 members");
        var owners = new HashSet<String>();
        var names = new HashSet<String>();
        for (ServiceSource source : mojo.services) {
            if (source == null) throw new IllegalArgumentException("CONFIG: null service member");
            identity(source.getServiceId());
            identity(source.getSkillName());
            if (!owners.add(source.getServiceId()) || !names.add(source.getSkillName()))
                throw new IllegalArgumentException("CONFIG: service owners and Skill output names must be unique");
        }
        if (!mojo.outputMode.equals("service")) {
            identity(mojo.aggregateId);
            identity(mojo.aggregateSkillName);
            if (owners.contains(mojo.aggregateId) || names.contains(mojo.aggregateSkillName))
                throw new IllegalArgumentException("CONFIG: aggregate identity/output collides with a service");
        }
    }

    private static void identity(String value) {
        if (value == null || !value.matches("[a-z0-9]+(?:-[a-z0-9]+)*") || value.length() > 63
                || value.matches("con|prn|aux|nul|com[0-9]|lpt[0-9]"))
            throw new IllegalArgumentException("CONFIG: use a safe lowercase identity under 64 characters");
    }

    private static void checkAggregateBudget(Map<String, Map<String, String>> services) {
        long bytes = 0;
        long files = 0;
        for (var service : services.values()) {
            files += service.size();
            for (String value : service.values()) bytes += value.getBytes(StandardCharsets.UTF_8).length;
        }
        if (files > 10_000 || bytes > 64L * 1024 * 1024)
            throw new IllegalArgumentException("LIMIT: aggregate service inputs exceed 10000 files or 64 MiB");
    }
}
