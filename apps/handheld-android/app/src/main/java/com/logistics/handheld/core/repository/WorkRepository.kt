package com.logistics.handheld.core.repository

import androidx.room.withTransaction
import com.logistics.handheld.core.database.HandheldDatabase
import com.logistics.handheld.core.database.OutboxDao
import com.logistics.handheld.core.database.OutboxEventEntity
import com.logistics.handheld.core.database.PackageCacheDao
import com.logistics.handheld.core.database.TaskSessionDao
import com.logistics.handheld.core.feedback.FeedbackKind
import com.logistics.handheld.core.feedback.OperatorFeedback
import com.logistics.handheld.core.model.CapturedLocation
import com.logistics.handheld.core.model.HandheldAction
import com.logistics.handheld.core.model.NetworkState
import com.logistics.handheld.core.model.OperationalContext
import com.logistics.handheld.core.model.PackageSummary
import com.logistics.handheld.core.model.SessionState
import com.logistics.handheld.core.model.SyncState
import com.logistics.handheld.core.model.TaskType
import com.logistics.handheld.core.model.WorkSession
import com.logistics.handheld.core.network.HandheldApi
import com.logistics.handheld.core.network.NetworkMonitor
import com.logistics.handheld.core.network.ScanResultDto
import com.logistics.handheld.core.network.StartSessionRequest
import com.logistics.handheld.core.preferences.DevicePreferences
import com.logistics.handheld.core.sync.SyncScheduler
import kotlinx.coroutines.flow.Flow
import java.time.Instant
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

data class CaptureRequest(
    val session: WorkSession,
    val action: HandheldAction,
    val identifier: String,
    val pairedContainerBarcode: String = "",
    val context: OperationalContext = OperationalContext(),
    val location: CapturedLocation? = null,
)

@Singleton
class WorkRepository @Inject constructor(
    private val api: HandheldApi,
    private val database: HandheldDatabase,
    private val sessions: TaskSessionDao,
    private val outbox: OutboxDao,
    private val packageCache: PackageCacheDao,
    private val devices: DevicePreferences,
    private val network: NetworkMonitor,
    private val scheduler: SyncScheduler,
    private val feedback: OperatorFeedback,
) {
    val events: Flow<List<OutboxEventEntity>> = outbox.observeAll()
    val activeSessions: Flow<List<com.logistics.handheld.core.database.LocalTaskSessionEntity>> =
        sessions.observeActive()

    suspend fun startSession(task: TaskType, employeeId: String): WorkSession {
        check(network.currentlyOnline()) { "A new task session must be started online." }
        val deviceId = devices.installationId()
        val response = api.startSession(
            StartSessionRequest(task, deviceId, NetworkState.ONLINE),
        ).data
        val session = WorkSession(
            response.session.id,
            task,
            deviceId,
            response.session.terminalId,
            response.session.createdAt,
            SessionState.valueOf(response.snapshot.currentState),
            NetworkState.valueOf(response.snapshot.networkState),
        )
        sessions.save(session.toEntity(employeeId))
        return session
    }

    suspend fun transition(session: WorkSession, transition: String): WorkSession {
        check(network.currentlyOnline()) { "Session controls require a network connection." }
        if (transition == "complete") {
            check(outbox.pendingCount(session.id) == 0) {
                "Synchronize pending work before completing this task."
            }
        }
        val result = when (transition) {
            "pause" -> api.pauseSession(session.id)
            "resume" -> api.resumeSession(session.id)
            "complete" -> api.completeSession(session.id)
            else -> error("Unsupported session transition")
        }.data
        val updated = session.copy(
            state = SessionState.valueOf(result.snapshot.currentState),
            networkState = NetworkState.valueOf(result.snapshot.networkState),
        )
        sessions.updateState(updated.id, updated.state.name, result.snapshot.lastAcceptedActivityAt)
        return updated
    }

    suspend fun updateContext(sessionId: String, context: OperationalContext) {
        sessions.updateContext(
            sessionId,
            context.trailerBarcode.ifBlank { null },
            context.routeCode.ifBlank { null },
            context.truckUnitNumber.ifBlank { null },
        )
    }

    /**
     * Restores the operator's last selected trailer, route, and truck from the
     * local session snapshot when an interrupted task is resumed.
     */
    suspend fun context(sessionId: String): OperationalContext =
        sessions.find(sessionId)?.let {
            OperationalContext(
                trailerBarcode = it.selectedTrailerBarcode.orEmpty(),
                routeCode = it.selectedRouteCode.orEmpty(),
                truckUnitNumber = it.selectedTruckUnitNumber.orEmpty(),
            )
        } ?: OperationalContext()

    suspend fun capture(request: CaptureRequest): OutboxEventEntity {
        val deviceId = devices.installationId()
        val now = Instant.now().toString()
        val online = network.currentlyOnline()
        val containerIdentifier = request.action in setOf(
            HandheldAction.LOAD_CONTAINER_TO_TRAILER,
            HandheldAction.UNLOAD_CONTAINER_FROM_TRAILER,
            HandheldAction.CLOSE_CONTAINER,
        )
        val event = OutboxEventEntity(
            clientEventId = UUID.randomUUID().toString(),
            taskSessionId = request.session.id,
            action = request.action.name,
            trackingNumber = request.identifier.takeUnless { containerIdentifier || it.isBlank() }
                ?.trim()?.uppercase(),
            containerBarcode = if (containerIdentifier) {
                request.identifier.trim().uppercase()
            } else {
                request.pairedContainerBarcode.trim().uppercase().ifBlank { null }
            },
            trailerBarcode = request.context.trailerBarcode.trim().uppercase().ifBlank { null },
            routeCode = request.context.routeCode.trim().uppercase().ifBlank { null },
            truckUnitNumber = request.context.truckUnitNumber.trim().uppercase().ifBlank { null },
            deviceId = deviceId,
            deviceTimestamp = now,
            latitude = request.location?.latitude,
            longitude = request.location?.longitude,
            gpsAccuracyMetres = request.location?.accuracyMetres?.toDouble(),
            gpsCapturedAt = request.location?.capturedAt,
            networkStateAtCapture = if (online) NetworkState.ONLINE.name
            else NetworkState.OFFLINE_NETWORK.name,
            syncState = SyncState.PENDING.name,
            message = if (online) "Sending to operations..." else "Saved offline; awaiting validation.",
            createdAt = now,
        )

        // Local durability always precedes operator confirmation or transport.
        outbox.insert(event)
        if (!online) {
            scheduler.enqueue()
            feedback.signal(FeedbackKind.PENDING)
            return event
        }
        return runCatching {
            val result = api.scan(event.toCommand()).data
            applyOutcome(result)
            if (result.status == "ACCEPTED") {
                sessions.updateState(event.taskSessionId, SessionState.ACTIVE.name, result.serverReceivedAt)
            }
            feedback.signal(if (result.status == "REJECTED") FeedbackKind.REJECTED else FeedbackKind.ACCEPTED)
            requireNotNull(outbox.find(event.clientEventId))
        }.getOrElse {
            scheduler.enqueue()
            feedback.signal(FeedbackKind.PENDING)
            outbox.save(
                event.copy(
                    retryCount = 1,
                    message = "Connection interrupted; command queued for retry.",
                ),
            )
            requireNotNull(outbox.find(event.clientEventId))
        }
    }

    suspend fun reverse(original: OutboxEventEntity): OutboxEventEntity {
        require(original.syncState() in setOf(SyncState.ACCEPTED, SyncState.DUPLICATE_ACCEPTED))
        val receiptId = requireNotNull(original.receiptId) { "Server receipt is unavailable." }
        val now = Instant.now().toString()
        val reversal = original.copy(
            clientEventId = UUID.randomUUID().toString(),
            receiptId = null,
            serverEventId = null,
            originalClientEventId = original.clientEventId,
            originalReceiptId = receiptId,
            action = HandheldAction.REVERSE_EVENT.name,
            deviceTimestamp = now,
            serverReceivedAt = null,
            networkStateAtCapture = if (network.currentlyOnline()) NetworkState.ONLINE.name
            else NetworkState.OFFLINE_NETWORK.name,
            syncState = SyncState.PENDING.name,
            code = null,
            message = "Reversal queued for validation.",
            exceptionFlags = "",
            retryCount = 0,
            createdAt = now,
            resolvedAt = null,
        )
        outbox.insert(reversal)
        if (!network.currentlyOnline()) {
            scheduler.enqueue()
            return reversal
        }
        return runCatching {
            val result = api.reverse(receiptId, reversal.toCommand()).data
            database.withTransaction {
                applyOutcome(result)
                if (result.status == "REVERSED") {
                    outbox.markOriginalReversed(original.clientEventId, Instant.now().toString())
                }
            }
            requireNotNull(outbox.find(reversal.clientEventId))
        }.getOrElse {
            scheduler.enqueue()
            reversal
        }
    }

    suspend fun dismissRejected(clientEventId: String) {
        outbox.dismissRejected(clientEventId, Instant.now().toString())
    }

    fun synchronize() = scheduler.enqueue()

    suspend fun packageLookup(trackingNumber: String): PackageSummary {
        val normalized = trackingNumber.trim().uppercase()
        if (network.currentlyOnline()) {
            val summary = api.packageLookup(normalized).data.toDomain()
            packageCache.save(summary.toEntity())
            return summary
        }
        return requireNotNull(packageCache.find(normalized)) {
            "This package is not cached. Reconnect for authoritative lookup."
        }.let {
            PackageSummary(
                it.trackingNumber,
                it.postalCode,
                it.routeCode,
                it.currentStatus,
                it.containerBarcode,
                it.trailerBarcode,
            )
        }
    }

    private suspend fun applyOutcome(result: ScanResultDto) {
        val state = if (result.status == "REJECTED") SyncState.REJECTED_ACTION_REQUIRED.name
        else result.status
        outbox.updateOutcome(
            result.clientEventId,
            state,
            result.id,
            result.serverEventId,
            result.code,
            result.message,
            result.exceptionFlags.orEmpty().joinToString(SEPARATOR),
            result.serverReceivedAt,
            Instant.now().toString(),
        )
    }
}
