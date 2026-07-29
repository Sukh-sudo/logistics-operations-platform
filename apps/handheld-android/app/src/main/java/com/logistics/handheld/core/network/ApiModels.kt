package com.logistics.handheld.core.network

import com.logistics.handheld.core.model.HandheldAction
import com.logistics.handheld.core.model.NetworkState
import com.logistics.handheld.core.model.TaskType
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = false)
data class ApiEnvelope<T>(val success: Boolean, val data: T)

@JsonClass(generateAdapter = false)
data class LoginRequest(
    val badgeBarcode: String,
    val employeeId: String,
    val deviceId: String,
)

@JsonClass(generateAdapter = false)
data class RefreshRequest(val refreshToken: String)

@JsonClass(generateAdapter = false)
data class LogoutRequest(val refreshToken: String)

@JsonClass(generateAdapter = false)
data class EmployeeDto(
    val id: String,
    val employeeNumber: String,
    val firstName: String,
    val lastName: String,
    val roles: List<String>,
)

@JsonClass(generateAdapter = false)
data class TerminalDto(
    val id: Int,
    val terminalCode: String,
    val name: String,
)

@JsonClass(generateAdapter = false)
data class TokenResponse(
    val accessToken: String,
    val refreshToken: String,
    val tokenType: String,
    val expiresIn: Int,
    val employee: EmployeeDto? = null,
    val terminal: TerminalDto? = null,
)

@JsonClass(generateAdapter = false)
data class SessionSnapshotDto(
    val currentState: String,
    val networkState: String,
    val lastAcceptedActivityAt: String? = null,
)

@JsonClass(generateAdapter = false)
data class WorkSessionDto(
    val id: String,
    val taskType: String,
    val deviceId: String,
    val terminalId: Int,
    val createdAt: String,
    val snapshot: SessionSnapshotDto? = null,
)

@JsonClass(generateAdapter = false)
data class BootstrapConfigurationDto(
    val inactivityMinutes: Int,
    val gpsLowAccuracyThresholdMetres: Double,
    val localHistoryRetentionHours: Int,
)

@JsonClass(generateAdapter = false)
data class BootstrapDto(
    val employee: EmployeeDto,
    val terminal: TerminalDto,
    val authorizedTasks: List<String>,
    val activeSessions: List<WorkSessionDto>,
    val serverTime: String,
    val configuration: BootstrapConfigurationDto,
    val apiVersion: String,
)

@JsonClass(generateAdapter = false)
data class StartSessionRequest(
    val taskType: TaskType,
    val deviceId: String,
    val networkState: NetworkState,
)

@JsonClass(generateAdapter = false)
data class StartSessionResponse(
    val session: WorkSessionDto,
    val snapshot: SessionSnapshotDto,
)

@JsonClass(generateAdapter = false)
data class TransitionResponse(val snapshot: SessionSnapshotDto)

@JsonClass(generateAdapter = false)
data class ScanCommandDto(
    val taskSessionId: String,
    val clientEventId: String,
    val action: HandheldAction,
    val deviceId: String,
    val deviceTimestamp: String,
    val networkStateAtCapture: NetworkState,
    val trackingNumber: String? = null,
    val containerBarcode: String? = null,
    val trailerBarcode: String? = null,
    val routeCode: String? = null,
    val truckUnitNumber: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val gpsAccuracyMetres: Double? = null,
    val gpsCapturedAt: String? = null,
    val exceptionFlags: List<String>? = null,
)

@JsonClass(generateAdapter = false)
data class SyncRequest(
    val taskSessionId: String,
    val batchId: String,
    val events: List<ScanCommandDto>,
)

@JsonClass(generateAdapter = false)
data class ScanResultDto(
    val id: String,
    val clientEventId: String,
    val status: String,
    val resultStatus: String,
    val serverEventId: String,
    val code: String,
    val message: String,
    val serverReceivedAt: String? = null,
    val exceptionFlags: List<String>? = null,
)

@JsonClass(generateAdapter = false)
data class SyncResponse(val batchId: String, val results: List<ScanResultDto>)

@JsonClass(generateAdapter = false)
data class PackageSummaryDto(
    val trackingNumber: String,
    val postalCode: String? = null,
    val routeCode: String? = null,
    val currentStatus: String? = null,
    val containerBarcode: String? = null,
    val trailerBarcode: String? = null,
)
