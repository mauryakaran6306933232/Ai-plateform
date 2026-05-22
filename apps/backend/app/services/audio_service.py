import asyncio
import logging
import os
import shutil
import warnings

logger = logging.getLogger(__name__)

class AudioService:
    def __init__(self):
        self.model = None
        self.is_loading = False
        
        # CRITICAL: Verify FFmpeg is installed and in PATH on startup
        self.ffmpeg_available = shutil.which('ffmpeg') is not None
        if not self.ffmpeg_available:
            logger.error("■■ [Audio] FFmpeg NOT FOUND in PATH! Whisper transcription will fail.")
            logger.error("■■ [Audio] Please install FFmpeg, add it to your system PATH, and RESTART your terminal/IDE.")

    def _load_model(self):
        """Load whisper model (runs in thread)"""
        if self.model:
            return
        self.is_loading = True
        logger.info("■ [Audio] Loading Whisper base model (first time may take a minute)...")
        import whisper
        self.model = whisper.load_model("base")
        self.is_loading = False
        logger.info("■ [Audio] Whisper model loaded successfully.")

    def _transcribe_sync(self, filepath: str) -> str:
        """Synchronous transcription"""
        # 1. Check FFmpeg dependency before even attempting
        if not self.ffmpeg_available:
            return "Transcription failed: FFmpeg is not installed or not in your system PATH. Please install FFmpeg and restart the server."

        # 2. Check if file exists
        if not os.path.exists(filepath):
            return f"Transcription failed: Audio file not found at {filepath}"

        if not self.model:
            self._load_model()

        # 3. Suppress the FP16 CPU warning and force FP32 for CPU stability/speed
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            result = self.model.transcribe(filepath, fp16=False)
            
        return result["text"]

    async def transcribe(self, filepath: str) -> str:
        """Async wrapper for transcription"""
        logger.info(f"■ [Audio] Transcribing: {filepath}")
        try:
            text = await asyncio.to_thread(self._transcribe_sync, filepath)
            return text
        except Exception as e:
            logger.error(f"■ [Audio] Transcription failed: {e}")
            return f"Error transcribing audio: {str(e)}"

# Singleton
audio_service = AudioService()