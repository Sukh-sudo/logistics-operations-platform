package com.logistics.handheld.core.repository

import androidx.room.withTransaction
import com.logistics.handheld.core.auth.TokenStore
import com.logistics.handheld.core.auth.DeviceCredentialStore
import com.logistics.handheld.core.database.BootstrapDao
import com.logistics.handheld.core.database.HandheldDatabase
import com.logistics.handheld.core.database.TaskSessionDao
import com.logistics.handheld.core.model.Bootstrap
import com.logistics.handheld.core.network.HandheldApi
import com.logistics.handheld.core.network.LoginRequest
import com.logistics.handheld.core.network.LogoutRequest
import com.logistics.handheld.core.network.NetworkMonitor
import com.logistics.handheld.core.preferences.DevicePreferences
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val api: HandheldApi,
    private val tokens: TokenStore,
    private val deviceCredentials: DeviceCredentialStore,
    private val devicePreferences: DevicePreferences,
    private val network: NetworkMonitor,
    private val database: HandheldDatabase,
    private val bootstrapDao: BootstrapDao,
    private val sessions: TaskSessionDao,
) {
    fun hasAuthenticatedShift() = tokens.read() != null

    fun isDeviceEnrolled() = deviceCredentials.read() != null

    suspend fun deviceId() = devicePreferences.installationId()

    fun saveDeviceCredential(credential: String) {
        require(credential.trim().length >= 32) { "Enter the complete enrollment credential." }
        deviceCredentials.save(credential)
    }

    suspend fun login(badge: String, employeeNumber: String): Bootstrap {
        check(network.currentlyOnline()) { "First login requires a network connection." }
        val deviceCredential = checkNotNull(deviceCredentials.read()) {
            "This device must be enrolled before an employee can sign in."
        }
        val response = api.login(
            LoginRequest(
                badge.trim().uppercase(),
                employeeNumber.trim().uppercase(),
                devicePreferences.installationId(),
                deviceCredential,
            ),
        ).data
        tokens.save(response.accessToken, response.refreshToken)
        return runCatching { refreshBootstrap() }.getOrElse {
            tokens.clear()
            throw it
        }
    }

    suspend fun bootstrap(): Bootstrap? {
        if (!hasAuthenticatedShift()) return null
        if (network.currentlyOnline()) {
            runCatching { return refreshBootstrap() }
        }
        val cached = bootstrapDao.read() ?: return null
        return cached.toDomain(sessions.active())
    }

    suspend fun logout() {
        val refresh = tokens.read()?.refreshToken
        if (refresh != null && network.currentlyOnline()) {
            runCatching { api.logout(LogoutRequest(refresh)) }
        }
        tokens.clear()
        database.withTransaction { bootstrapDao.clear() }
    }

    suspend fun refreshBootstrap(): Bootstrap {
        val bootstrap = api.bootstrap().data.toDomain()
        database.withTransaction {
            bootstrapDao.save(bootstrap.toCache())
            bootstrap.activeSessions.forEach { sessions.save(it.toEntity(bootstrap.employee.id)) }
        }
        return bootstrap
    }
}
