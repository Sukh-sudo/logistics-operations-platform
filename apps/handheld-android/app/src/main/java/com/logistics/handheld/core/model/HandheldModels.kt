package com.logistics.handheld.core.model

enum class NetworkState { ONLINE, OFFLINE_NETWORK }
enum class SessionState { ACTIVE, PAUSED, INACTIVE_OFFLINE, COMPLETED }
enum class SyncState {
    PENDING,
    SYNCING,
    ACCEPTED,
    REJECTED_ACTION_REQUIRED,
    DUPLICATE_ACCEPTED,
    REVERSED,
    DISMISSED_LOCAL,
}

enum class TaskType {
    TRAILER_LOAD,
    TRAILER_UNLOAD,
    CONTAINER_LOAD,
    CONTAINER_UNLOAD,
    LAST_MILE_LOADING,
    COURIER_DELIVERY,
}

enum class HandheldAction {
    LOAD_PACKAGE_TO_TRAILER,
    UNLOAD_PACKAGE_FROM_TRAILER,
    LOAD_PACKAGE_TO_CONTAINER,
    UNLOAD_PACKAGE_FROM_CONTAINER,
    LOAD_CONTAINER_TO_TRAILER,
    UNLOAD_CONTAINER_FROM_TRAILER,
    CLOSE_CONTAINER,
    CLOSE_TRAILER,
    LOAD_PACKAGE_TO_ROUTE,
    REMOVE_PACKAGE_FROM_ROUTE,
    PACKAGE_OUT_FOR_DELIVERY,
    PACKAGE_DELIVERED,
    PACKAGE_ATTEMPTED_DELIVERY,
    PACKAGE_DAMAGED,
    PACKAGE_MISROUTED,
    PACKAGE_RETURNED_TO_TERMINAL,
    REVERSE_EVENT,
}

data class Employee(
    val id: String,
    val employeeNumber: String,
    val firstName: String,
    val lastName: String,
    val roles: List<String>,
)

data class Terminal(
    val id: Int,
    val terminalCode: String,
    val name: String,
)

data class WorkSession(
    val id: String,
    val taskType: TaskType,
    val deviceId: String,
    val terminalId: Int,
    val createdAt: String,
    val state: SessionState,
    val networkState: NetworkState,
)

data class Bootstrap(
    val employee: Employee,
    val terminal: Terminal,
    val authorizedTasks: List<String>,
    val activeSessions: List<WorkSession>,
    val inactivityMinutes: Int,
    val gpsLowAccuracyThresholdMetres: Double,
    val localHistoryRetentionHours: Int,
)

data class OperationalContext(
    val trailerBarcode: String = "",
    val routeCode: String = "",
    val truckUnitNumber: String = "",
)

data class CapturedLocation(
    val latitude: Double,
    val longitude: Double,
    val accuracyMetres: Float,
    val capturedAt: String,
)

data class PackageSummary(
    val trackingNumber: String,
    val postalCode: String?,
    val routeCode: String?,
    val currentStatus: String?,
    val containerBarcode: String?,
    val trailerBarcode: String?,
)
