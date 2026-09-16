package io.github.fyuanz.openapi.skill.core;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.time.Duration;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.*;

class ServiceSkillUpdaterConcurrencyTest {
    @TempDir Path temporary;

    @Test
    void sameOutputIsLockedAndAConflictingServiceCannotOverwriteIt() throws Exception {
        Path output = temporary.resolve("skills");
        var updater = new ServiceSkillUpdater();
        var entered = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<ServiceSkillUpdater.UpdateResult> active = executor.submit(() ->
                    updater.update("orders", "shared-api", output, Duration.ofSeconds(2), () -> {
                        entered.countDown();
                        assertTrue(release.await(1, TimeUnit.SECONDS));
                        return ServiceSkillUpdaterTest.skill("orders", "shared-api", "owner");
                    }));
            assertTrue(entered.await(1, TimeUnit.SECONDS));

            var contender = updater.update("orders", "shared-api", output, Duration.ofSeconds(2),
                    () -> ServiceSkillUpdaterTest.skill("orders", "shared-api", "contender"));
            assertEquals(ServiceSkillUpdater.Outcome.LOCKED, contender.outcome());
            release.countDown();
            assertEquals(ServiceSkillUpdater.Outcome.SUCCESS, active.get(2, TimeUnit.SECONDS).outcome());
        } finally {
            executor.shutdownNow();
        }

        var invoked = new AtomicBoolean();
        var collision = updater.update("billing", "shared-api", output, Duration.ofSeconds(2), () -> {
            invoked.set(true);
            return ServiceSkillUpdaterTest.skill("billing", "shared-api", "collision");
        });
        assertEquals(ServiceSkillUpdater.Outcome.FAILED, collision.outcome());
        assertFalse(invoked.get());
        assertTrue(collision.message().contains("owned"));
        assertTrue(ServiceSkillUpdaterTest.tree(output.resolve("shared-api")).values().stream()
                .anyMatch(content -> content.contains("orders")));
    }

    @Test
    void independentServicesCanGenerateAndPublishConcurrently() throws Exception {
        Path output = temporary.resolve("skills");
        var updater = new ServiceSkillUpdater();
        var barrier = new CyclicBarrier(2);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<ServiceSkillUpdater.UpdateResult> orders = executor.submit(() ->
                    updater.update("orders", "orders-api", output, Duration.ofSeconds(2), () -> {
                        barrier.await(1, TimeUnit.SECONDS);
                        return ServiceSkillUpdaterTest.skill("orders", "orders-api", "orders");
                    }));
            Future<ServiceSkillUpdater.UpdateResult> billing = executor.submit(() ->
                    updater.update("billing", "billing-api", output, Duration.ofSeconds(2), () -> {
                        barrier.await(1, TimeUnit.SECONDS);
                        return ServiceSkillUpdaterTest.skill("billing", "billing-api", "billing");
                    }));

            assertEquals(ServiceSkillUpdater.Outcome.SUCCESS, orders.get(3, TimeUnit.SECONDS).outcome());
            assertEquals(ServiceSkillUpdater.Outcome.SUCCESS, billing.get(3, TimeUnit.SECONDS).outcome());
        } finally {
            executor.shutdownNow();
        }
        assertTrue(ServiceSkillUpdaterTest.tree(output.resolve("orders-api")).values().stream()
                .anyMatch(content -> content.contains("orders")));
        assertTrue(ServiceSkillUpdaterTest.tree(output.resolve("billing-api")).values().stream()
                .anyMatch(content -> content.contains("billing")));
    }

    @Test
    void oneServiceFailureDoesNotBlockOrMutateAnotherService() throws Exception {
        Path output = temporary.resolve("skills");
        var updater = new ServiceSkillUpdater();
        var barrier = new CyclicBarrier(2);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<ServiceSkillUpdater.UpdateResult> orders = executor.submit(() ->
                    updater.update("orders", "orders-api", output, Duration.ofSeconds(2), () -> {
                        barrier.await(1, TimeUnit.SECONDS);
                        throw new IllegalArgumentException("orders input failed");
                    }));
            Future<ServiceSkillUpdater.UpdateResult> billing = executor.submit(() ->
                    updater.update("billing", "billing-api", output, Duration.ofSeconds(2), () -> {
                        barrier.await(1, TimeUnit.SECONDS);
                        return ServiceSkillUpdaterTest.skill("billing", "billing-api", "billing");
                    }));

            assertEquals(ServiceSkillUpdater.Outcome.FAILED, orders.get(3, TimeUnit.SECONDS).outcome());
            assertEquals(ServiceSkillUpdater.Outcome.SUCCESS, billing.get(3, TimeUnit.SECONDS).outcome());
        } finally {
            executor.shutdownNow();
        }
        assertFalse(java.nio.file.Files.exists(output.resolve("orders-api")));
        assertTrue(ServiceSkillUpdaterTest.tree(output.resolve("billing-api")).values().stream()
                .anyMatch(content -> content.contains("billing")));
    }
}
