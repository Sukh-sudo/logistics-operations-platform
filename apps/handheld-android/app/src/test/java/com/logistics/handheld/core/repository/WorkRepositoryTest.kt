package com.logistics.handheld.core.repository

import com.logistics.handheld.core.database.HandheldDatabase
import com.logistics.handheld.core.database.OutboxDao
import com.logistics.handheld.core.database.PackageCacheDao
import com.logistics.handheld.core.database.TaskSessionDao
import com.logistics.handheld.core.feedback.FeedbackKind
import com.logistics.handheld.core.feedback.OperatorFeedback
import com.logistics.handheld.core.model.HandheldAction
import com.logistics.handheld.core.model.NetworkState
import com.logistics.handheld.core.model.SessionState
import com.logistics.handheld.core.model.SyncState
import com.logistics.handheld.core.model.TaskType
import com.logistics.handheld.core.model.WorkSession
import com.logistics.handheld.core.network.HandheldApi
import com.logistics.handheld.core.network.NetworkMonitor
import com.logistics.handheld.core.preferences.DevicePreferences
import com.logistics.handheld.core.sync.SyncScheduler
import io.mockk.Runs
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.coVerifyOrder
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

class WorkRepositoryTest {
    private val api = mockk<HandheldApi>()
    private val database = mockk<HandheldDatabase>()
    private val sessions = mockk<TaskSessionDao>()
    private val outbox = mockk<OutboxDao>()
    private val packageCache = mockk<PackageCacheDao>()
    private val devices = mockk<DevicePreferences>()
    private val network = mockk<NetworkMonitor>()
    private val scheduler = mockk<SyncScheduler>()
    private val feedback = mockk<OperatorFeedback>()

    @Test
    fun `offline capture is durable before sync is scheduled`() = runTest {
        every { outbox.observeAll() } returns emptyFlow()
        every { sessions.observeActive() } returns emptyFlow()
        coEvery { devices.installationId() } returns "device-1"
        every { network.currentlyOnline() } returns false
        coEvery { outbox.insert(any()) } just Runs
        every { scheduler.enqueue() } just Runs
        every { feedback.signal(any()) } just Runs

        val repository = WorkRepository(
            api,
            database,
            sessions,
            outbox,
            packageCache,
            devices,
            network,
            scheduler,
            feedback,
        )
        val result = repository.capture(
            CaptureRequest(
                session = session(),
                action = HandheldAction.LOAD_PACKAGE_TO_TRAILER,
                identifier = " pkg-100 ",
            ),
        )

        assertEquals("PKG-100", result.trackingNumber)
        assertEquals(SyncState.PENDING.name, result.syncState)
        assertEquals(NetworkState.OFFLINE_NETWORK.name, result.networkStateAtCapture)
        coVerifyOrder {
            outbox.insert(any())
            scheduler.enqueue()
            feedback.signal(FeedbackKind.PENDING)
        }
        coVerify(exactly = 0) { api.scan(any()) }
    }

    private fun session() = WorkSession(
        id = "session-1",
        taskType = TaskType.TRAILER_LOAD,
        deviceId = "device-1",
        terminalId = 1,
        createdAt = "2026-07-29T12:00:00Z",
        state = SessionState.ACTIVE,
        networkState = NetworkState.ONLINE,
    )
}
