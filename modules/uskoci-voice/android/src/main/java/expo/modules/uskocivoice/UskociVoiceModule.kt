package expo.modules.uskocivoice

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Base64
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.math.sqrt

/** Foreground-only transient PCM; never creates an audio file or starts a service. */
class UskociVoiceModule : Module() {
  private val guard = Any()
  @Volatile private var activeId: String? = null
  @Volatile private var foreground = true
  private var recorder: AudioRecord? = null
  private var focusRequest: AudioFocusRequest? = null
  private val mainHandler = Handler(Looper.getMainLooper())

  override fun definition() = ModuleDefinition {
    Name("UskociVoice")
    Events("pcm", "interrupted")

    // Synchronous start/stop prevents an async queued start resurrecting an already-released gesture.
    Function("start") { sessionId: String, maxDurationMs: Double -> startCapture(sessionId, maxDurationMs.toLong()) }
    Function("stop") { sessionId: String -> stopCapture(sessionId) }
    OnActivityEntersForeground { foreground = true }
    OnActivityEntersBackground { foreground = false; interrupt("BACKGROUND") }
    OnActivityDestroys { foreground = false; interrupt("BACKGROUND") }
    OnDestroy { foreground = false; activeId?.let { stopCapture(it) } }
  }

  private fun startCapture(sessionId: String, maxDurationMs: Long): Unit = synchronized(guard) {
    val context = appContext.reactContext ?: throw IllegalStateException("MIC_UNAVAILABLE")
    if (!foreground || appContext.currentActivity == null || activeId != null
      || sessionId.length !in 1..120 || maxDurationMs !in 1..120000) throw IllegalStateException("MIC_UNAVAILABLE")
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
      throw IllegalStateException("MIC_PERMISSION_DENIED")
    }
    val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE)
      .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
      .setOnAudioFocusChangeListener({ focus ->
        if (focus < 0) interrupt("AUDIO_INTERRUPTED")
      }, mainHandler).build()
    if (audioManager.requestAudioFocus(request) != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
      throw IllegalStateException("MIC_UNAVAILABLE")
    }
    focusRequest = request
    val minimum = AudioRecord.getMinBufferSize(16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
    if (minimum <= 0) { audioManager.abandonAudioFocusRequest(request); focusRequest = null; throw IllegalStateException("MIC_UNAVAILABLE") }
    activeId = sessionId
    try {
      val next = AudioRecord.Builder().setAudioSource(MediaRecorder.AudioSource.VOICE_RECOGNITION)
        .setAudioFormat(AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT).setSampleRate(16000)
          .setChannelMask(AudioFormat.CHANNEL_IN_MONO).build()).setBufferSizeInBytes(maxOf(minimum, 6400)).build()
      recorder = next
      if (next.state != AudioRecord.STATE_INITIALIZED) throw IllegalStateException("MIC_UNAVAILABLE")
      next.startRecording()
      if (next.recordingState != AudioRecord.RECORDSTATE_RECORDING) throw IllegalStateException("MIC_UNAVAILABLE")
      val startAt = SystemClock.elapsedRealtime()
      Thread({
        val samples = ShortArray(1600)
        var sequence = 0
        try {
          while (activeId == sessionId && foreground) {
            if (SystemClock.elapsedRealtime() - startAt >= maxDurationMs) { interrupt("CAPTURE_TIMEOUT"); break }
            val count = next.read(samples, 0, samples.size, AudioRecord.READ_BLOCKING)
            if (activeId != sessionId || !foreground) break
            if (count <= 0) { interrupt("CAPTURE_FAILED"); break }
            val pcm = ByteArray(count * 2)
            var squares = 0.0
            for (index in 0 until count) {
              val sample = samples[index].toInt()
              pcm[index * 2] = (sample and 255).toByte()
              pcm[index * 2 + 1] = (sample shr 8).toByte()
              val normalized = sample.toDouble() / 32768.0
              squares += normalized * normalized
            }
            if (activeId == sessionId && foreground) sendEvent("pcm", mapOf("sessionId" to sessionId,
              "sequence" to sequence++, "pcmBase64" to Base64.encodeToString(pcm, Base64.NO_WRAP),
              "rms" to sqrt(squares / count).coerceIn(0.0, 1.0)))
            pcm.fill(0)
            samples.fill(0)
          }
        } catch (_: Exception) {
          if (activeId == sessionId) interrupt("CAPTURE_FAILED")
        } finally { samples.fill(0); stopCapture(sessionId) }
      }, "UskociTransientMic").start()
    } catch (_: Exception) { stopCapture(sessionId); throw IllegalStateException("MIC_UNAVAILABLE") }
  }

  private fun interrupt(code: String) {
    val id = activeId ?: return
    stopCapture(id)
    sendEvent("interrupted", mapOf("sessionId" to id, "code" to code))
  }

  private fun stopCapture(sessionId: String): Unit = synchronized(guard) {
    if (activeId != sessionId) return@synchronized
    activeId = null // Fence the capture thread before native I/O.
    val previous = recorder
    recorder = null
    try { previous?.stop() } catch (_: Exception) { }
    try { previous?.release() } catch (_: Exception) { }
    val request = focusRequest
    focusRequest = null
    if (request != null) {
      val context = appContext.reactContext
      val manager = context?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
      manager?.abandonAudioFocusRequest(request)
    }
  }
}
