package io.github.fyuanz.openapi.skill.core;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

class ServiceSkillUpdaterFailureTest {
    @TempDir Path temporary;

    @Test
    void replacementFailureRestoresThePreviousCompleteTree() throws Exception {
        Path output = temporary.resolve("skills");
        var normal = new ServiceSkillUpdater();
        normal.update("orders", "orders-api", output, Duration.ofSeconds(2),
                () -> ServiceSkillUpdaterTest.skill("orders", "orders-api", "old"));
        Map<String, String> before = ServiceSkillUpdaterTest.tree(output.resolve("orders-api"));
        var failing = new ServiceSkillUpdater((source, target) -> {
            if (source.toString().contains("staging")) throw new IOException("injected publish failure");
            Files.move(source, target, StandardCopyOption.ATOMIC_MOVE);
        });

        var result = failing.update("orders", "orders-api", output, Duration.ofSeconds(2),
                () -> ServiceSkillUpdaterTest.skill("orders", "orders-api", "new"));

        assertEquals(ServiceSkillUpdater.Outcome.FAILED, result.outcome());
        assertTrue(result.previousRetained());
        assertEquals(before, ServiceSkillUpdaterTest.tree(output.resolve("orders-api")));
        assertTrue(result.message().contains("injected publish failure"));
    }

    @Test
    void failedRestoreKeepsTheCompleteBackupForRecovery() throws Exception {
        Path output = temporary.resolve("skills");
        var normal = new ServiceSkillUpdater();
        normal.update("orders", "orders-api", output, Duration.ofSeconds(2),
                () -> ServiceSkillUpdaterTest.skill("orders", "orders-api", "old"));
        Map<String, String> before = ServiceSkillUpdaterTest.tree(output.resolve("orders-api"));
        var failing = new ServiceSkillUpdater((source, target) -> {
            if (source.toString().contains("staging")) {
                Files.createDirectories(target);
                Files.writeString(target.resolve("partial.txt"), "partial publication");
                throw new IOException("injected publish failure");
            }
            if (source.toString().contains("backups")) {
                Files.createDirectories(target);
                Files.writeString(target.resolve("partial.txt"), "partial restore");
                throw new IOException("injected restore failure");
            }
            Files.move(source, target, StandardCopyOption.ATOMIC_MOVE);
        });

        var result = failing.update("orders", "orders-api", output, Duration.ofSeconds(2),
                () -> ServiceSkillUpdaterTest.skill("orders", "orders-api", "new"));

        assertEquals(ServiceSkillUpdater.Outcome.FAILED, result.outcome());
        assertFalse(result.previousRetained());
        Path backups = output.resolve(".openapi-skill/backups");
        try (var entries = Files.list(backups)) {
            Path backup = entries.findFirst().orElseThrow();
            assertEquals(before, ServiceSkillUpdaterTest.tree(backup));
        }
    }

    @Test
    void timedOutGenerationCanNeverPublishLater() throws Exception {
        Path output = temporary.resolve("skills");
        var finished = new CountDownLatch(1);

        var result = new ServiceSkillUpdater().update("orders", "orders-api", output, Duration.ofMillis(30), () -> {
            try { Thread.sleep(180); }
            catch (InterruptedException ignored) { Thread.sleep(180); }
            finally { finished.countDown(); }
            return ServiceSkillUpdaterTest.skill("orders", "orders-api", "late");
        });

        assertEquals(ServiceSkillUpdater.Outcome.TIMED_OUT, result.outcome());
        assertFalse(result.skillAvailable());
        assertTrue(finished.await(3, TimeUnit.SECONDS));
        assertFalse(Files.exists(output.resolve("orders-api")));
    }

    @Test
    void stagingWriteFailureLeavesThePreviousTreeUntouched() throws Exception {
        Path output = temporary.resolve("skills");
        var updater = new ServiceSkillUpdater();
        updater.update("orders", "orders-api", output, Duration.ofSeconds(2),
                () -> ServiceSkillUpdaterTest.skill("orders", "orders-api", "old"));
        Map<String, String> before = ServiceSkillUpdaterTest.tree(output.resolve("orders-api"));
        Path staging = output.resolve(".openapi-skill/staging");
        Files.delete(staging);
        Files.writeString(staging, "block directory creation");

        var result = updater.update("orders", "orders-api", output, Duration.ofSeconds(2),
                () -> ServiceSkillUpdaterTest.skill("orders", "orders-api", "new"));

        assertEquals(ServiceSkillUpdater.Outcome.FAILED, result.outcome());
        assertTrue(result.previousRetained());
        assertEquals(before, ServiceSkillUpdaterTest.tree(output.resolve("orders-api")));
    }

    @Test
    void statusFailureIsReturnedAsAWarningWithoutUndoingSuccessfulPublication() throws Exception {
        Path output = temporary.resolve("skills");
        Files.createDirectories(output.resolve(".openapi-skill"));
        Files.writeString(output.resolve(".openapi-skill/status"), "block status directory");

        var result = new ServiceSkillUpdater().update("orders", "orders-api", output, Duration.ofSeconds(2),
                () -> ServiceSkillUpdaterTest.skill("orders", "orders-api", "new"));

        assertEquals(ServiceSkillUpdater.Outcome.SUCCESS, result.outcome());
        assertTrue(result.skillAvailable());
        assertFalse(result.statusWritten());
        assertTrue(result.message().contains("status"));
        assertTrue(Files.isDirectory(output.resolve("orders-api")));
    }
}
