package com.logistics.handheld.core.database

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(
    entities = [
        BootstrapCacheEntity::class,
        LocalTaskSessionEntity::class,
        OutboxEventEntity::class,
        LocalPackageSummaryEntity::class,
    ],
    version = 1,
    exportSchema = true,
)
abstract class HandheldDatabase : RoomDatabase() {
    abstract fun bootstrapDao(): BootstrapDao
    abstract fun taskSessionDao(): TaskSessionDao
    abstract fun outboxDao(): OutboxDao
    abstract fun packageCacheDao(): PackageCacheDao
}
