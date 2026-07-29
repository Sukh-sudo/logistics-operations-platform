package com.logistics.handheld.core.preferences

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.first
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

private val Context.handheldDataStore by preferencesDataStore("handheld_device")

@Singleton
class DevicePreferences @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    suspend fun installationId(): String {
        val current = context.handheldDataStore.data.first()[INSTALLATION_ID]
        if (current != null) return current
        val created = UUID.randomUUID().toString()
        context.handheldDataStore.edit { it[INSTALLATION_ID] = created }
        return created
    }

    private companion object {
        val INSTALLATION_ID = stringPreferencesKey("installation_id")
    }
}
