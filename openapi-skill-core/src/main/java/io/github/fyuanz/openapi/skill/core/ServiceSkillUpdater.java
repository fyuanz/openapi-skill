package io.github.fyuanz.openapi.skill.core;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.channels.OverlappingFileLockException;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/** Publishes one complete generated Skill while keeping status outside the Skill directory. */
public final class ServiceSkillUpdater {
    private static final int MAX_FILES = 10_000;
    private static final long MAX_BYTES = 64L * 1024 * 1024;
    private final DirectoryMover mover;
    private final GeneratedSkillValidator validator = new GeneratedSkillValidator();
    private final ObjectMapper mapper = new ObjectMapper();

    public ServiceSkillUpdater() {
        this(ServiceSkillUpdater::moveDirectory);
    }

    ServiceSkillUpdater(DirectoryMover mover) {
        this.mover = Objects.requireNonNull(mover, "mover");
    }

    /** Runs bounded generation and publishes only a validated complete service Skill. */
    public UpdateResult update(String serviceId, String skillName, Path outputParent, Duration timeout,
                               Callable<Map<String, String>> generation) {
        validateName(serviceId);
        validateName(skillName);
        Objects.requireNonNull(outputParent, "outputParent");
        Objects.requireNonNull(generation, "generation");
        if (timeout == null || timeout.isZero() || timeout.isNegative())
            throw new IllegalArgumentException("CONFIG: timeout must be positive");

        Path output = outputParent.toAbsolutePath().normalize();
        if (output.getParent() == null) throw new IllegalArgumentException("CONFIG: output parent cannot be a filesystem root");
        Path skill = output.resolve(skillName);
        Path state = output.resolve(".openapi-skill");
        Path status = state.resolve("status").resolve(serviceId + ".json");
        try {
            Files.createDirectories(output);
            if (Files.isSymbolicLink(output)) throw new IOException("output parent must not be a symbolic link");
            Files.createDirectories(state.resolve("locks"));
        } catch (Exception error) {
            return result(Outcome.FAILED, false, false, message(error), serviceId, skillName, skill, status);
        }

        Path lockPath = state.resolve("locks").resolve(skillName + ".lock");
        try (FileChannel channel = FileChannel.open(lockPath, StandardOpenOption.CREATE, StandardOpenOption.WRITE)) {
            FileLock acquired;
            try { acquired = channel.tryLock(); }
            catch (OverlappingFileLockException error) { acquired = null; }
            if (acquired == null) {
                boolean available = isValidOwnedSkill(skill, serviceId, skillName);
                return result(Outcome.LOCKED, available, available,
                        "another update owns the output lock", serviceId, skillName, skill, status);
            }
            final FileLock lock = acquired;
            try (lock) {
                return updateLocked(serviceId, skillName, skill, state, status, timeout, generation);
            }
        } catch (Exception error) {
            boolean available = isValidOwnedSkill(skill, serviceId, skillName);
            return result(Outcome.FAILED, available, available, message(error), serviceId, skillName, skill, status);
        }
    }

    private UpdateResult updateLocked(String serviceId, String skillName, Path skill, Path state, Path status,
                                      Duration timeout, Callable<Map<String, String>> generation) {
        boolean previous = false;
        if (Files.exists(skill)) {
            try {
                if (!Files.isDirectory(skill) || Files.isSymbolicLink(skill))
                    throw new IOException("existing output is not a generator-owned Skill directory");
                validator.validate(readTree(skill), serviceId, skillName);
                previous = true;
            } catch (Exception error) {
                String detail = error.getMessage() == null ? error.getClass().getSimpleName() : error.getMessage();
                return result(Outcome.FAILED, false, false,
                        "existing output is not a valid generator-owned Skill: " + detail,
                        serviceId, skillName, skill, status);
            }
        }

        Generated generated = generate(generation, timeout);
        if (generated.outcome() != Outcome.SUCCESS)
            return result(generated.outcome(), previous, previous, generated.message(),
                    serviceId, skillName, skill, status);

        try {
            validator.validate(generated.files(), serviceId, skillName);
        } catch (Exception error) {
            return result(Outcome.FAILED, previous, previous, message(error), serviceId, skillName, skill, status);
        }

        Path stagingParent = state.resolve("staging");
        Path backupParent = state.resolve("backups");
        Path attempt = stagingParent.resolve(skillName + "-" + UUID.randomUUID());
        Path backup = backupParent.resolve(skillName + "-" + UUID.randomUUID());
        boolean previousMoved = false;
        try {
            Files.createDirectories(stagingParent);
            Files.createDirectory(attempt);
            writeTree(attempt, generated.files());
            validator.validate(readTree(attempt), serviceId, skillName);
            if (previous) {
                Files.createDirectories(backupParent);
                mover.move(skill, backup);
                previousMoved = true;
            }
            try {
                mover.move(attempt, skill);
                validator.validate(readTree(skill), serviceId, skillName);
            } catch (Exception publishError) {
                try {
                    if (Files.exists(skill)) deleteTree(skill);
                    if (previousMoved && Files.exists(backup)) {
                        mover.move(backup, skill);
                        validator.validate(readTree(skill), serviceId, skillName);
                        previousMoved = false;
                    }
                } catch (Exception recoveryError) {
                    throw new IOException(message(publishError) + "; recovery failed: " + message(recoveryError),
                            publishError);
                }
                throw publishError;
            }
            String successMessage = "published complete Skill";
            if (Files.exists(backup)) {
                try { deleteTree(backup); }
                catch (IOException cleanupError) { successMessage += "; backup cleanup failed: " + message(cleanupError); }
            }
            return result(Outcome.SUCCESS, true, false, successMessage, serviceId, skillName, skill, status);
        } catch (Exception error) {
            boolean retained = previous && isValidOwnedSkill(skill, serviceId, skillName);
            return result(Outcome.FAILED, retained, retained, message(error), serviceId, skillName, skill, status);
        } finally {
            try { if (Files.exists(attempt)) deleteTree(attempt); }
            catch (IOException ignored) { /* The returned failure/status already preserves the published result. */ }
        }
    }

    private Generated generate(Callable<Map<String, String>> generation, Duration timeout) {
        ExecutorService executor = Executors.newSingleThreadExecutor(task -> {
            Thread thread = new Thread(task, "openapi-skill-generation");
            thread.setDaemon(true);
            return thread;
        });
        Future<Map<String, String>> future = executor.submit(generation);
        try {
            return new Generated(Outcome.SUCCESS, future.get(timeout.toNanos(), TimeUnit.NANOSECONDS), "generated");
        } catch (TimeoutException error) {
            future.cancel(true);
            return new Generated(Outcome.TIMED_OUT, null, "generation timed out after " + timeout);
        } catch (InterruptedException error) {
            future.cancel(true);
            Thread.currentThread().interrupt();
            return new Generated(Outcome.FAILED, null, "update interrupted");
        } catch (ExecutionException error) {
            return new Generated(Outcome.FAILED, null, message(error.getCause()));
        } finally {
            executor.shutdownNow();
        }
    }

    private UpdateResult result(Outcome outcome, boolean available, boolean retained, String message,
                                String serviceId, String skillName, Path skill, Path status) {
        boolean written = true;
        String finalMessage = message == null || message.isBlank() ? outcome.name().toLowerCase(Locale.ROOT) : message;
        try { writeStatus(status, serviceId, skillName, outcome, available, retained, finalMessage); }
        catch (Exception error) {
            written = false;
            finalMessage += "; status write failed: " + ServiceSkillUpdater.message(error);
        }
        return new UpdateResult(outcome, available, retained, written, finalMessage, skill, status);
    }

    private void writeStatus(Path status, String serviceId, String skillName, Outcome outcome,
                             boolean available, boolean retained, String message) throws IOException {
        Files.createDirectories(status.getParent());
        var value = mapper.createObjectNode().put("statusVersion", 1).put("serviceId", serviceId)
                .put("skillName", skillName).put("attemptedAt", Instant.now().toString())
                .put("outcome", outcome.name()).put("skillAvailable", available)
                .put("previousRetained", retained).put("message", message);
        Path temporary = status.getParent().resolve(status.getFileName() + "." + UUID.randomUUID() + ".tmp");
        try {
            Files.writeString(temporary, mapper.writerWithDefaultPrettyPrinter().writeValueAsString(value),
                    StandardCharsets.UTF_8, StandardOpenOption.CREATE_NEW);
            moveFileReplacing(temporary, status);
        } finally {
            Files.deleteIfExists(temporary);
        }
    }

    private void writeTree(Path root, Map<String, String> files) throws IOException {
        for (var entry : files.entrySet()) {
            Path target = root.resolve(entry.getKey()).normalize();
            if (!target.startsWith(root)) throw new IOException("generated path escapes staging: " + entry.getKey());
            Files.createDirectories(target.getParent());
            Files.writeString(target, entry.getValue(), StandardCharsets.UTF_8, StandardOpenOption.CREATE_NEW);
        }
    }

    private Map<String, String> readTree(Path root) throws IOException {
        var result = new TreeMap<String, String>();
        long bytes = 0;
        try (var paths = Files.walk(root)) {
            for (var iterator = paths.iterator(); iterator.hasNext();) {
                Path path = iterator.next();
                if (Files.isSymbolicLink(path)) throw new IOException("symbolic links are not allowed in a generated Skill");
                if (Files.isRegularFile(path)) {
                    if (result.size() == MAX_FILES) throw new IOException("generated file count exceeds " + MAX_FILES);
                    bytes += Files.size(path);
                    if (bytes > MAX_BYTES) throw new IOException("generated content exceeds 64 MiB");
                    result.put(root.relativize(path).toString().replace('\\', '/'), Files.readString(path));
                } else if (!Files.isDirectory(path)) {
                    throw new IOException("unsupported filesystem entry in generated Skill");
                }
            }
        }
        return result;
    }

    private boolean isValidOwnedSkill(Path skill, String serviceId, String skillName) {
        if (!Files.isDirectory(skill) || Files.isSymbolicLink(skill)) return false;
        try { validator.validate(readTree(skill), serviceId, skillName); return true; }
        catch (Exception ignored) { return false; }
    }

    private static void moveDirectory(Path source, Path target) throws IOException {
        try { Files.move(source, target, StandardCopyOption.ATOMIC_MOVE); }
        catch (AtomicMoveNotSupportedException error) { Files.move(source, target); }
    }

    private static void moveFileReplacing(Path source, Path target) throws IOException {
        try { Files.move(source, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING); }
        catch (AtomicMoveNotSupportedException error) {
            Files.move(source, target, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private static void deleteTree(Path root) throws IOException {
        try (var paths = Files.walk(root)) {
            for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(path);
        }
    }

    private static void validateName(String value) {
        if (value == null || !value.matches("[a-z0-9]+(?:-[a-z0-9]+)*") || value.length() > 63
                || value.matches("con|prn|aux|nul|com[0-9]|lpt[0-9]"))
            throw new IllegalArgumentException("CONFIG: service and Skill names must be safe lowercase identifiers");
    }

    private static String message(Throwable error) {
        if (error == null) return "unknown failure";
        return error.getMessage() == null || error.getMessage().isBlank()
                ? error.getClass().getSimpleName() : error.getMessage();
    }

    public enum Outcome { SUCCESS, FAILED, TIMED_OUT, LOCKED }

    public record UpdateResult(Outcome outcome, boolean skillAvailable, boolean previousRetained,
                               boolean statusWritten, String message, Path skillDirectory, Path statusFile) {}

    @FunctionalInterface
    interface DirectoryMover {
        void move(Path source, Path target) throws IOException;
    }

    private record Generated(Outcome outcome, Map<String, String> files, String message) {}
}
