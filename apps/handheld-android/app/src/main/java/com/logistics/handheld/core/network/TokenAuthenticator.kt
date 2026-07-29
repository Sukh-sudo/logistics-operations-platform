package com.logistics.handheld.core.network

import com.logistics.handheld.core.auth.TokenStore
import kotlinx.coroutines.runBlocking
import okhttp3.Authenticator
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route
import javax.inject.Inject
import javax.inject.Provider

class TokenAuthenticator @Inject constructor(
    private val tokenStore: TokenStore,
    private val api: Provider<HandheldApi>,
) : Authenticator {
    override fun authenticate(route: Route?, response: Response): Request? {
        if (response.request.url.encodedPath.endsWith("/auth/refresh") || responseCount(response) > 1) {
            tokenStore.clear()
            return null
        }
        val refresh = tokenStore.read()?.refreshToken ?: return null
        val tokens = runCatching {
            runBlocking { api.get().refresh(RefreshRequest(refresh)).data }
        }.getOrElse {
            tokenStore.clear()
            return null
        }
        tokenStore.save(tokens.accessToken, tokens.refreshToken)
        return response.request.newBuilder()
            .header("Authorization", "Bearer ${tokens.accessToken}")
            .build()
    }

    private fun responseCount(response: Response): Int {
        var count = 1
        var prior = response.priorResponse
        while (prior != null) {
            count++
            prior = prior.priorResponse
        }
        return count
    }
}
