from fastapi import APIRouter, BackgroundTasks, UploadFile, File
from app.services.metrics_service import metrics_service
from app.services.execution_service import execution_service
import os

router = APIRouter()

@router.get("/dashboard")
async def analytics_dashboard():
    return {
        "status": "online",
        "models_loaded": ["llama3", "yolov8-sim", "whisper-base"],
        "active_streams": 1 if metrics_service.is_running else 0
    }

@router.post("/stream/start")
async def start_stream(background_tasks: BackgroundTasks):
    if not metrics_service.is_running:
        background_tasks.add_task(metrics_service.start_stream)
        return {"status": "streaming", "message": "Analytics stream started"}
    return {"status": "already_streaming"}

@router.post("/stream/stop")
async def stop_stream():
    metrics_service.stop_stream()
    return {"status": "stopped"}

@router.get("/models")
async def list_models():
    return {
        "models": [
            {"name": "Llama3", "type": "reasoning", "status": "ready"},
            {"name": "YOLOv8 (Sim)", "type": "object_detection", "status": "ready"},
            {"name": "Whisper", "type": "speech_recognition", "status": "ready"},
        ]
    }

# ==========================================
# AUDIO INTELLIGENCE (BACKGROUND WEBSOCKET)
# ==========================================
async def process_audio_background(filepath: str, filename: str):
    """Background task to transcribe audio and notify via WebSocket"""
    from app.services.audio_service import audio_service
    from app.websocket_manager import ws_manager
    
    try:
        # Notify start
        await ws_manager.broadcast("jarvis:proactive_alert", {
            "severity": "info",
            "title": f"🎙️ Processing Audio: {filename}",
            "message": "Whisper AI is transcribing your audio file. This may take a few minutes on CPU..."
        })
        
        transcription = await audio_service.transcribe(filepath)
        
        # Save transcription to workspace
        txt_filename = filename.rsplit('.', 1)[0] + "_transcription.txt"
        execution_service.save_code(txt_filename, f"Audio Transcription: {filename}\n\n{transcription}")
        
        # Notify completion
        short_text = transcription[:500] + "..." if len(transcription) > 500 else transcription
        await ws_manager.broadcast("jarvis:proactive_alert", {
            "severity": "success",
            "title": f"✅ Audio Transcribed: {filename}",
            "message": short_text
        })
    except Exception as e:
        await ws_manager.broadcast("jarvis:proactive_alert", {
            "severity": "warning",
            "title": f"❌ Audio Transcription Failed: {filename}",
            "message": str(e)
        })

# FIX: background_tasks MUST come before file=File(...) in the parameter list!
@router.post("/audio/transcribe")
async def transcribe_audio(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Upload an audio file for background transcription via Whisper"""
    if not file.filename.lower().endswith(('.mp3', '.wav', '.m4a', '.flac')):
        return {"error": "Only audio files (.mp3, .wav, .m4a, .flac) are supported"}

    # 1. Save to workspace
    filepath = os.path.join(execution_service.workspace_dir, file.filename)
    with open(filepath, "wb") as buffer:
        content = await file.read()
        buffer.write(content)

    # 2. Add to background tasks (Instant return, no timeout!)
    background_tasks.add_task(process_audio_background, filepath, file.filename)

    return {
        "status": "processing",
        "filename": file.filename,
        "message": "Audio uploaded. Whisper is transcribing in the background. Check your notifications!"
    }