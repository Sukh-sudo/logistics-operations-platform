package com.logistics.handheld.core.database

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "bootstrap_cache")
data class BootstrapCacheEntity(
    @PrimaryKey val id: Int = 1,
    val employeeId: String,
    val employeeNumber: String,
    val firstName: String,
    val lastName: String,
    val roles: String,
    val terminalId: Int,
    val terminalCode: String,
    val terminalName: String,
    val authorizedTasks: String,
    val inactivityMinutes: Int,
    val gpsLowAccuracyThresholdMetres: Double,
    val localHistoryRetentionHours: Int,
    val updatedAt: String,
)

@Entity(tableName = "task_sessions")
data class LocalTaskSessionEntity(
    @PrimaryKey val serverSessionId: String,
    val employeeId: String,
    val terminalId: Int,
    val deviceId: String,
    val taskType: String,
    val startedAt: String,
    val lastAcceptedActivityAt: String?,
    val activityState: String,
    val networkState: String,
    val selectedTrailerBarcode: String? = null,
    val selectedRouteCode: String? = null,
    val selectedTruckUnitNumber: String? = null,
)

@Entity(tableName = "outbox_events")
data class OutboxEventEntity(
    @PrimaryKey val clientEventId: String,
    val receiptId: String? = null,
    val serverEventId: String? = null,
    val originalClientEventId: String? = null,
    val originalReceiptId: String? = null,
    val taskSessionId: String,
    val action: String,
    val trackingNumber: String? = null,
    val containerBarcode: String? = null,
    val trailerBarcode: String? = null,
    val routeCode: String? = null,
    val truckUnitNumber: String? = null,
    val deviceId: String,
    val deviceTimestamp: String,
    val serverReceivedAt: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val gpsAccuracyMetres: Double? = null,
    val gpsCapturedAt: String? = null,
    val networkStateAtCapture: String,
    val syncState: String,
    val code: String? = null,
    val message: String,
    val exceptionFlags: String = "",
    val retryCount: Int = 0,
    val createdAt: String,
    val resolvedAt: String? = null,
)

@Entity(tableName = "package_cache")
data class LocalPackageSummaryEntity(
    @PrimaryKey val trackingNumber: String,
    val postalCode: String?,
    val routeCode: String?,
    val currentStatus: String?,
    val containerBarcode: String?,
    val trailerBarcode: String?,
    val cacheUpdatedAt: String,
)
