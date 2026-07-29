package com.logistics.handheld.core.scanner

import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import com.google.mlkit.vision.barcode.BarcodeScanner
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Abstraction around camera frame decoding. A future rugged-device adapter can
 * replace the ML Kit implementation without changing workflow state.
 */
interface BarcodeFrameScanner : ImageAnalysis.Analyzer, AutoCloseable

/**
 * Converts CameraX frames into one barcode result. A scanner screen is closed
 * after a result, so accepting one value also prevents duplicate scan events.
 */
class CameraBarcodeAnalyzer(
    private val onBarcode: (String) -> Unit,
    private val scanner: BarcodeScanner = BarcodeScanning.getClient(),
) : BarcodeFrameScanner {
    private val processing = AtomicBoolean(false)
    private val delivered = AtomicBoolean(false)

    @ExperimentalGetImage
    override fun analyze(imageProxy: ImageProxy) {
        val mediaImage = imageProxy.image
        if (mediaImage == null || delivered.get() || !processing.compareAndSet(false, true)) {
            imageProxy.close()
            return
        }

        val image = InputImage.fromMediaImage(
            mediaImage,
            imageProxy.imageInfo.rotationDegrees,
        )
        scanner.process(image)
            .addOnSuccessListener { barcodes ->
                val value = barcodes.firstNotNullOfOrNull { it.rawValue?.trim()?.takeIf(String::isNotEmpty) }
                if (value != null && delivered.compareAndSet(false, true)) {
                    onBarcode(value)
                }
            }
            .addOnCompleteListener {
                processing.set(false)
                imageProxy.close()
            }
    }

    override fun close() {
        scanner.close()
    }
}
