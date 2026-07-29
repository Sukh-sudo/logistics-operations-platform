package com.logistics.handheld.core.database

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface BootstrapDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun save(entity: BootstrapCacheEntity)

    @Query("SELECT * FROM bootstrap_cache WHERE id = 1")
    suspend fun read(): BootstrapCacheEntity?

    @Query("DELETE FROM bootstrap_cache")
    suspend fun clear()
}

@Dao
interface TaskSessionDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun save(session: LocalTaskSessionEntity)

    @Query("SELECT * FROM task_sessions WHERE activityState != 'COMPLETED' ORDER BY startedAt DESC")
    fun observeActive(): Flow<List<LocalTaskSessionEntity>>

    @Query("SELECT * FROM task_sessions WHERE activityState != 'COMPLETED' ORDER BY startedAt DESC")
    suspend fun active(): List<LocalTaskSessionEntity>

    @Query("SELECT * FROM task_sessions WHERE serverSessionId = :id")
    suspend fun find(id: String): LocalTaskSessionEntity?

    @Query("UPDATE task_sessions SET activityState = :state, lastAcceptedActivityAt = :activityAt WHERE serverSessionId = :id")
    suspend fun updateState(id: String, state: String, activityAt: String?)

    @Query(
        """UPDATE task_sessions SET selectedTrailerBarcode = :trailer,
            selectedRouteCode = :route, selectedTruckUnitNumber = :truck
            WHERE serverSessionId = :id""",
    )
    suspend fun updateContext(id: String, trailer: String?, route: String?, truck: String?)
}

@Dao
interface OutboxDao {
    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insert(event: OutboxEventEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun save(event: OutboxEventEntity)

    @Query("SELECT * FROM outbox_events ORDER BY deviceTimestamp DESC")
    fun observeAll(): Flow<List<OutboxEventEntity>>

    @Query(
        """SELECT * FROM outbox_events
           WHERE syncState IN ('PENDING', 'SYNCING')
           ORDER BY deviceTimestamp ASC""",
    )
    suspend fun pendingInCaptureOrder(): List<OutboxEventEntity>

    @Query("SELECT * FROM outbox_events WHERE clientEventId = :id")
    suspend fun find(id: String): OutboxEventEntity?

    @Query(
        """UPDATE outbox_events SET syncState = :syncState, receiptId = :receiptId,
           serverEventId = :serverEventId, code = :code, message = :message,
           exceptionFlags = :flags, serverReceivedAt = :serverReceivedAt,
           resolvedAt = :resolvedAt WHERE clientEventId = :clientEventId""",
    )
    suspend fun updateOutcome(
        clientEventId: String,
        syncState: String,
        receiptId: String?,
        serverEventId: String?,
        code: String?,
        message: String,
        flags: String,
        serverReceivedAt: String?,
        resolvedAt: String?,
    )

    @Query("UPDATE outbox_events SET syncState = 'SYNCING' WHERE clientEventId IN (:ids)")
    suspend fun markSyncing(ids: List<String>)

    @Query(
        """UPDATE outbox_events SET syncState = 'PENDING',
           retryCount = retryCount + 1, message = :message
           WHERE clientEventId IN (:ids) AND syncState = 'SYNCING'""",
    )
    suspend fun resetForRetry(ids: List<String>, message: String)

    @Query(
        """UPDATE outbox_events SET syncState = 'REVERSED',
           message = 'Original accepted event was reversed.', resolvedAt = :resolvedAt
           WHERE clientEventId = :clientEventId""",
    )
    suspend fun markOriginalReversed(clientEventId: String, resolvedAt: String)

    @Query(
        """UPDATE outbox_events SET syncState = 'DISMISSED_LOCAL', resolvedAt = :resolvedAt
           WHERE clientEventId = :clientEventId AND syncState = 'REJECTED_ACTION_REQUIRED'""",
    )
    suspend fun dismissRejected(clientEventId: String, resolvedAt: String)

    @Query(
        """DELETE FROM outbox_events WHERE resolvedAt IS NOT NULL
           AND resolvedAt < :cutoff
           AND syncState NOT IN ('PENDING', 'SYNCING', 'REJECTED_ACTION_REQUIRED')""",
    )
    suspend fun purgeResolvedBefore(cutoff: String)

    @Query(
        """SELECT COUNT(*) FROM outbox_events
           WHERE taskSessionId = :sessionId AND syncState IN ('PENDING', 'SYNCING')""",
    )
    suspend fun pendingCount(sessionId: String): Int
}

@Dao
interface PackageCacheDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun save(summary: LocalPackageSummaryEntity)

    @Query("SELECT * FROM package_cache WHERE trackingNumber = :trackingNumber")
    suspend fun find(trackingNumber: String): LocalPackageSummaryEntity?
}
