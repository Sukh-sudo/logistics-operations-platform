package com.logistics.handheld.core.sync

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.room.withTransaction
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.logistics.handheld.core.database.BootstrapDao
import com.logistics.handheld.core.database.HandheldDatabase
import com.logistics.handheld.core.database.OutboxDao
import com.logistics.handheld.core.database.OutboxEventEntity
import com.logistics.handheld.core.network.HandheldApi
import com.logistics.handheld.core.network.ScanResultDto
import com.logistics.handheld.core.network.SyncRequest
import com.logistics.handheld.core.repository.SEPARATOR
import com.logistics.handheld.core.repository.toCommand
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

@HiltWorker
class OutboxSyncWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted parameters: WorkerParameters,
    private val api: HandheldApi,
    private val database: HandheldDatabase,
    private val outbox: OutboxDao,
    private val bootstrap: BootstrapDao,
) : CoroutineWorker(context, parameters) {
    override suspend fun doWork(): Result {
        val pending = outbox.pendingInCaptureOrder()
        if (pending.isEmpty()) {
            purgeResolved()
            return Result.success()
        }
        val ids = pending.map { it.clientEventId }
        outbox.markSyncing(ids)
        return try {
            val normal = pending.filter { it.action != "REVERSE_EVENT" }
            normal.groupBy { it.taskSessionId }.forEach { (sessionId, events) ->
                events.chunked(100).forEach { chunk ->
                    val response = api.sync(
                        SyncRequest(sessionId, UUID.randomUUID().toString(), chunk.map { it.toCommand() }),
                    ).data
                    response.results.forEach { applyOutcome(it) }
                }
            }
            pending.filter { it.action == "REVERSE_EVENT" }.forEach { reversal ->
                val receipt = requireNotNull(reversal.originalReceiptId)
                val result = api.reverse(receipt, reversal.toCommand()).data
                applyOutcome(result)
                if (result.status == "REVERSED" && reversal.originalClientEventId != null) {
                    outbox.markOriginalReversed(reversal.originalClientEventId, Instant.now().toString())
                }
            }
            purgeResolved()
            Result.success()
        } catch (_: Exception) {
            outbox.resetForRetry(ids, "Synchronization interrupted; queued for retry.")
            Result.retry()
        }
    }

    private suspend fun applyOutcome(result: ScanResultDto) {
        val state = if (result.status == "REJECTED") "REJECTED_ACTION_REQUIRED" else result.status
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

    private suspend fun purgeResolved() {
        val hours = bootstrap.read()?.localHistoryRetentionHours ?: 8
        val cutoff = Instant.now().minus(hours.toLong(), ChronoUnit.HOURS).toString()
        outbox.purgeResolvedBefore(cutoff)
    }
}
