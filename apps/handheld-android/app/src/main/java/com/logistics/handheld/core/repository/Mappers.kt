package com.logistics.handheld.core.repository

import com.logistics.handheld.core.database.BootstrapCacheEntity
import com.logistics.handheld.core.database.LocalPackageSummaryEntity
import com.logistics.handheld.core.database.LocalTaskSessionEntity
import com.logistics.handheld.core.database.OutboxEventEntity
import com.logistics.handheld.core.model.Bootstrap
import com.logistics.handheld.core.model.Employee
import com.logistics.handheld.core.model.HandheldAction
import com.logistics.handheld.core.model.NetworkState
import com.logistics.handheld.core.model.PackageSummary
import com.logistics.handheld.core.model.SessionState
import com.logistics.handheld.core.model.SyncState
import com.logistics.handheld.core.model.TaskType
import com.logistics.handheld.core.model.Terminal
import com.logistics.handheld.core.model.WorkSession
import com.logistics.handheld.core.network.BootstrapDto
import com.logistics.handheld.core.network.PackageSummaryDto
import com.logistics.handheld.core.network.ScanCommandDto
import java.time.Instant

internal fun BootstrapDto.toDomain() = Bootstrap(
    employee = Employee(
        employee.id,
        employee.employeeNumber,
        employee.firstName,
        employee.lastName,
        employee.roles,
    ),
    terminal = Terminal(terminal.id, terminal.terminalCode, terminal.name),
    authorizedTasks = authorizedTasks,
    activeSessions = activeSessions.map { session ->
        WorkSession(
            session.id,
            TaskType.valueOf(session.taskType),
            session.deviceId,
            session.terminalId,
            session.createdAt,
            SessionState.valueOf(session.snapshot?.currentState ?: "ACTIVE"),
            NetworkState.valueOf(session.snapshot?.networkState ?: "ONLINE"),
        )
    },
    inactivityMinutes = configuration.inactivityMinutes,
    gpsLowAccuracyThresholdMetres = configuration.gpsLowAccuracyThresholdMetres,
    localHistoryRetentionHours = configuration.localHistoryRetentionHours,
)

internal fun Bootstrap.toCache() = BootstrapCacheEntity(
    employeeId = employee.id,
    employeeNumber = employee.employeeNumber,
    firstName = employee.firstName,
    lastName = employee.lastName,
    roles = employee.roles.joinToString(SEPARATOR),
    terminalId = terminal.id,
    terminalCode = terminal.terminalCode,
    terminalName = terminal.name,
    authorizedTasks = authorizedTasks.joinToString(SEPARATOR),
    inactivityMinutes = inactivityMinutes,
    gpsLowAccuracyThresholdMetres = gpsLowAccuracyThresholdMetres,
    localHistoryRetentionHours = localHistoryRetentionHours,
    updatedAt = Instant.now().toString(),
)

internal fun BootstrapCacheEntity.toDomain(sessions: List<LocalTaskSessionEntity>) = Bootstrap(
    employee = Employee(employeeId, employeeNumber, firstName, lastName, split(roles)),
    terminal = Terminal(terminalId, terminalCode, terminalName),
    authorizedTasks = split(authorizedTasks),
    activeSessions = sessions.map { it.toDomain() },
    inactivityMinutes = inactivityMinutes,
    gpsLowAccuracyThresholdMetres = gpsLowAccuracyThresholdMetres,
    localHistoryRetentionHours = localHistoryRetentionHours,
)

internal fun WorkSession.toEntity(employeeId: String) = LocalTaskSessionEntity(
    serverSessionId = id,
    employeeId = employeeId,
    terminalId = terminalId,
    deviceId = deviceId,
    taskType = taskType.name,
    startedAt = createdAt,
    lastAcceptedActivityAt = null,
    activityState = state.name,
    networkState = networkState.name,
)

internal fun LocalTaskSessionEntity.toDomain() = WorkSession(
    serverSessionId,
    TaskType.valueOf(taskType),
    deviceId,
    terminalId,
    startedAt,
    SessionState.valueOf(activityState),
    NetworkState.valueOf(networkState),
)

internal fun OutboxEventEntity.toCommand() = ScanCommandDto(
    taskSessionId = taskSessionId,
    clientEventId = clientEventId,
    action = HandheldAction.valueOf(action),
    deviceId = deviceId,
    deviceTimestamp = deviceTimestamp,
    networkStateAtCapture = NetworkState.valueOf(networkStateAtCapture),
    trackingNumber = trackingNumber,
    containerBarcode = containerBarcode,
    trailerBarcode = trailerBarcode,
    routeCode = routeCode,
    truckUnitNumber = truckUnitNumber,
    latitude = latitude,
    longitude = longitude,
    gpsAccuracyMetres = gpsAccuracyMetres,
    gpsCapturedAt = gpsCapturedAt,
    exceptionFlags = split(exceptionFlags).ifEmpty { null },
)

internal fun OutboxEventEntity.syncState() = SyncState.valueOf(syncState)
internal fun OutboxEventEntity.flags() = split(exceptionFlags)

internal fun PackageSummaryDto.toDomain() = PackageSummary(
    trackingNumber,
    postalCode,
    routeCode,
    currentStatus,
    containerBarcode,
    trailerBarcode,
)

internal fun PackageSummary.toEntity() = LocalPackageSummaryEntity(
    trackingNumber,
    postalCode,
    routeCode,
    currentStatus,
    containerBarcode,
    trailerBarcode,
    Instant.now().toString(),
)

internal const val SEPARATOR = "\u001F"
internal fun split(value: String) = value.split(SEPARATOR).filter { it.isNotBlank() }
