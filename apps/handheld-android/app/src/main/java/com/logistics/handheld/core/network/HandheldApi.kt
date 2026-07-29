package com.logistics.handheld.core.network

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface HandheldApi {
    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): ApiEnvelope<TokenResponse>

    @POST("auth/refresh")
    suspend fun refresh(@Body request: RefreshRequest): ApiEnvelope<TokenResponse>

    @POST("auth/logout")
    suspend fun logout(@Body request: LogoutRequest): ApiEnvelope<Map<String, Boolean>>

    @GET("bootstrap")
    suspend fun bootstrap(): ApiEnvelope<BootstrapDto>

    @POST("work-sessions")
    suspend fun startSession(@Body request: StartSessionRequest): ApiEnvelope<StartSessionResponse>

    @POST("work-sessions/{id}/pause")
    suspend fun pauseSession(@Path("id") id: String): ApiEnvelope<TransitionResponse>

    @POST("work-sessions/{id}/resume")
    suspend fun resumeSession(@Path("id") id: String): ApiEnvelope<TransitionResponse>

    @POST("work-sessions/{id}/complete")
    suspend fun completeSession(@Path("id") id: String): ApiEnvelope<TransitionResponse>

    @POST("scans")
    suspend fun scan(@Body command: ScanCommandDto): ApiEnvelope<ScanResultDto>

    @POST("sync")
    suspend fun sync(@Body request: SyncRequest): ApiEnvelope<SyncResponse>

    @POST("events/{receiptId}/reverse")
    suspend fun reverse(
        @Path("receiptId") receiptId: String,
        @Body command: ScanCommandDto,
    ): ApiEnvelope<ScanResultDto>

    @GET("packages/{trackingNumber}")
    suspend fun packageLookup(
        @Path("trackingNumber") trackingNumber: String,
    ): ApiEnvelope<PackageSummaryDto>
}
