package com.logistics.handheld.core.database

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.logistics.handheld.core.model.NetworkState
import com.logistics.handheld.core.model.SessionState
import com.logistics.handheld.core.model.SyncState
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Runs Room against an in-memory Android SQLite database on the JVM. These
 * integration tests verify the exact persistence behavior used by offline
 * capture and task resume without requiring a connected phone.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class HandheldDatabaseIntegrationTest {
    private lateinit var database: HandheldDatabase

    @Before
    fun createDatabase() {
        database = Room.inMemoryDatabaseBuilder(
            ApplicationProvider.getApplicationContext(),
            HandheldDatabase::class.java,
        ).allowMainThreadQueries().build()
    }

    @After
    fun closeDatabase() {
        database.close()
    }

    @Test
    fun eventOutboxPreservesCaptureOrderForSynchronization() = runBlocking {
        val later = event("later", "2026-07-29T12:01:00Z")
        val earlier = event("earlier", "2026-07-29T12:00:00Z")
        database.outboxDao().insert(later)
        database.outboxDao().insert(earlier)

        val pending = database.outboxDao().pendingInCaptureOrder()

        assertEquals(listOf("earlier", "later"), pending.map { it.clientEventId })
    }

    @Test
    fun sessionContextSnapshotSurvivesTaskResume() = runBlocking {
        val session = LocalTaskSessionEntity(
            serverSessionId = "session-1",
            employeeId = "employee-1",
            terminalId = 1,
            deviceId = "device-1",
            taskType = "TRAILER_LOAD",
            startedAt = "2026-07-29T12:00:00Z",
            lastAcceptedActivityAt = null,
            activityState = SessionState.ACTIVE.name,
            networkState = NetworkState.ONLINE.name,
        )
        database.taskSessionDao().save(session)
        database.taskSessionDao().updateContext("session-1", "TRL-9", null, null)

        val restored = database.taskSessionDao().observeActive().first().single()

        assertEquals("TRL-9", restored.selectedTrailerBarcode)
        assertNull(restored.selectedRouteCode)
    }

    private fun event(id: String, timestamp: String) = OutboxEventEntity(
        clientEventId = id,
        taskSessionId = "session-1",
        action = "LOAD_PACKAGE_TO_TRAILER",
        trackingNumber = "PKG-$id",
        deviceId = "device-1",
        deviceTimestamp = timestamp,
        networkStateAtCapture = NetworkState.OFFLINE_NETWORK.name,
        syncState = SyncState.PENDING.name,
        message = "Saved offline",
        createdAt = timestamp,
    )
}
