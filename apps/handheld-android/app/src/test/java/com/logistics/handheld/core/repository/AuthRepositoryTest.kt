package com.logistics.handheld.core.repository

import com.logistics.handheld.core.auth.DeviceCredentialStore
import com.logistics.handheld.core.auth.TokenStore
import com.logistics.handheld.core.database.BootstrapDao
import com.logistics.handheld.core.database.HandheldDatabase
import com.logistics.handheld.core.database.TaskSessionDao
import com.logistics.handheld.core.network.HandheldApi
import com.logistics.handheld.core.network.NetworkMonitor
import com.logistics.handheld.core.preferences.DevicePreferences
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertTrue
import org.junit.Test

class AuthRepositoryTest {
    private val api = mockk<HandheldApi>()
    private val tokens = mockk<TokenStore>(relaxed = true)
    private val deviceCredentials = mockk<DeviceCredentialStore>(relaxed = true)
    private val devices = mockk<DevicePreferences>()
    private val network = mockk<NetworkMonitor>()
    private val database = mockk<HandheldDatabase>()
    private val bootstrap = mockk<BootstrapDao>()
    private val sessions = mockk<TaskSessionDao>()

    @Test
    fun `login sends stored enrollment proof without changing employee fields`() = runTest {
        every { network.currentlyOnline() } returns true
        every { deviceCredentials.read() } returns "d".repeat(43)
        coEvery { devices.installationId() } returns "00000000-0000-4000-8000-000000000001"
        coEvery { api.login(any()) } throws IllegalStateException("stop after request")

        runCatching { repository().login(" badge-1 ", " emp-1 ") }

        coVerify {
            api.login(match {
                it.badgeBarcode == "BADGE-1" &&
                    it.employeeId == "EMP-1" &&
                    it.deviceId == "00000000-0000-4000-8000-000000000001" &&
                    it.deviceCredential == "d".repeat(43)
            })
        }
    }

    @Test
    fun `login fails before network authentication when device is not enrolled`() = runTest {
        every { network.currentlyOnline() } returns true
        every { deviceCredentials.read() } returns null

        val failure = runCatching { repository().login("BADGE-1", "EMP-1") }.exceptionOrNull()
        assertTrue(failure is IllegalStateException)
        coVerify(exactly = 0) { api.login(any()) }
    }

    private fun repository() = AuthRepository(
        api,
        tokens,
        deviceCredentials,
        devices,
        network,
        database,
        bootstrap,
        sessions,
    )
}
