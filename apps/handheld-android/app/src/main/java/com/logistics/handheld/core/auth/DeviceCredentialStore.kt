package com.logistics.handheld.core.auth

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/** Stores the enrollment secret separately so ending an employee shift does
 * not unenroll the managed device. Android Keystore protects the backing key. */
@Singleton
class DeviceCredentialStore @Inject constructor(@ApplicationContext context: Context) {
    private val preferences = EncryptedSharedPreferences.create(
        context,
        "handheld_device_enrollment",
        MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    fun read(): String? = preferences.getString(CREDENTIAL, null)

    fun save(credential: String) = preferences.edit()
        .putString(CREDENTIAL, credential.trim())
        .apply()

    private companion object {
        const val CREDENTIAL = "device_credential"
    }
}
