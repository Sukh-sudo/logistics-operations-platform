package com.logistics.handheld.core.auth

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

data class StoredTokens(val accessToken: String, val refreshToken: String)

/**
 * Tokens are encrypted with a key held by Android Keystore. Badge and employee
 * identifiers are intentionally not written to this store.
 */
@Singleton
class TokenStore @Inject constructor(@ApplicationContext context: Context) {
    private val preferences = EncryptedSharedPreferences.create(
        context,
        "handheld_credentials",
        MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    fun read(): StoredTokens? {
        val access = preferences.getString(ACCESS, null) ?: return null
        val refresh = preferences.getString(REFRESH, null) ?: return null
        return StoredTokens(access, refresh)
    }

    fun save(accessToken: String, refreshToken: String) {
        preferences.edit().putString(ACCESS, accessToken).putString(REFRESH, refreshToken).apply()
    }

    fun clear() = preferences.edit().clear().apply()

    private companion object {
        const val ACCESS = "access_token"
        const val REFRESH = "refresh_token"
    }
}
