package com.logistics.handheld.core.location

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.logistics.handheld.core.model.CapturedLocation
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.tasks.await
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

interface LocationProvider {
    suspend fun current(): CapturedLocation?
}

@Singleton
class HandheldLocationProvider @Inject constructor(
    @ApplicationContext private val context: Context,
) : LocationProvider {
    private val client = LocationServices.getFusedLocationProviderClient(context)

    @SuppressLint("MissingPermission")
    override suspend fun current(): CapturedLocation? {
        val allowed = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED
        if (!allowed) return null
        return runCatching {
            client.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null).await()
        }.getOrNull()?.let {
            CapturedLocation(
                latitude = it.latitude,
                longitude = it.longitude,
                accuracyMetres = it.accuracy,
                capturedAt = Instant.ofEpochMilli(it.time).toString(),
            )
        }
    }
}
