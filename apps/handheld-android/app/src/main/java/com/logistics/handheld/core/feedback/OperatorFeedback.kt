package com.logistics.handheld.core.feedback

import android.content.Context
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

enum class FeedbackKind { ACCEPTED, REJECTED, PENDING }

@Singleton
class OperatorFeedback @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    fun signal(kind: FeedbackKind) {
        val duration = if (kind == FeedbackKind.REJECTED) 180L else 70L
        val vibrator = if (Build.VERSION.SDK_INT >= 31) {
            context.getSystemService(VibratorManager::class.java).defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Vibrator::class.java)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(
                VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE),
            )
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(duration)
        }
        val tone = when (kind) {
            FeedbackKind.ACCEPTED -> ToneGenerator.TONE_PROP_ACK
            FeedbackKind.REJECTED -> ToneGenerator.TONE_PROP_NACK
            FeedbackKind.PENDING -> ToneGenerator.TONE_PROP_BEEP
        }
        ToneGenerator(AudioManager.STREAM_NOTIFICATION, 45).apply {
            startTone(tone, duration.toInt())
            release()
        }
    }
}
