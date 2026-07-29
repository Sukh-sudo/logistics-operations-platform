package com.logistics.handheld.core.di

import android.content.Context
import androidx.room.Room
import com.logistics.handheld.BuildConfig
import com.logistics.handheld.core.database.BootstrapDao
import com.logistics.handheld.core.database.HandheldDatabase
import com.logistics.handheld.core.database.OutboxDao
import com.logistics.handheld.core.database.PackageCacheDao
import com.logistics.handheld.core.database.TaskSessionDao
import com.logistics.handheld.core.location.HandheldLocationProvider
import com.logistics.handheld.core.location.LocationProvider
import com.logistics.handheld.core.network.AuthInterceptor
import com.logistics.handheld.core.network.HandheldApi
import com.logistics.handheld.core.network.TokenAuthenticator
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {
    @Provides
    @Singleton
    fun database(@ApplicationContext context: Context): HandheldDatabase =
        Room.databaseBuilder(context, HandheldDatabase::class.java, "handheld.db").build()

    @Provides fun bootstrapDao(database: HandheldDatabase): BootstrapDao = database.bootstrapDao()
    @Provides fun taskSessionDao(database: HandheldDatabase): TaskSessionDao = database.taskSessionDao()
    @Provides fun outboxDao(database: HandheldDatabase): OutboxDao = database.outboxDao()
    @Provides fun packageCacheDao(database: HandheldDatabase): PackageCacheDao = database.packageCacheDao()

    @Provides
    @Singleton
    fun moshi(): Moshi = Moshi.Builder().addLast(KotlinJsonAdapterFactory()).build()

    @Provides
    @Singleton
    fun httpClient(
        authInterceptor: AuthInterceptor,
        authenticator: TokenAuthenticator,
    ): OkHttpClient {
        val logging = HttpLoggingInterceptor().apply {
            // BASIC avoids logging employee identifiers, command bodies, and GPS.
            level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BASIC
            else HttpLoggingInterceptor.Level.NONE
            redactHeader("Authorization")
        }
        return OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .authenticator(authenticator)
            .addInterceptor(logging)
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build()
    }

    @Provides
    @Singleton
    fun handheldApi(client: OkHttpClient, moshi: Moshi): HandheldApi =
        Retrofit.Builder()
            .baseUrl(BuildConfig.HANDHELD_API_BASE_URL)
            .client(client)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()
            .create(HandheldApi::class.java)
}

@Module
@InstallIn(SingletonComponent::class)
abstract class LocationModule {
    @Binds abstract fun bindLocationProvider(implementation: HandheldLocationProvider): LocationProvider
}
