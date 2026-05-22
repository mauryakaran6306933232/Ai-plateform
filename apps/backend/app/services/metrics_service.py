import asyncio
import random
from app.websocket_manager import ws_manager

class MetricsService:
    def __init__(self):
        self.is_running = False
        self.tick = 0
        self.latest_data = None  

    async def start_stream(self):
        if self.is_running:
            return
        self.is_running = True
        print("\n [MetricsService] Starting analytics stream...")
        
        # Simulated classes for YOLOv8
        yolo_classes = ["Person", "Car", "Truck", "Dog", "Bicycle", "Laptop", "Phone"]

        while self.is_running:
            self.tick += 1
            
            # Simulate Video / Vision (Dynamic Bounding Boxes)
            num_objects = random.randint(1, 4)
            objects_detected = random.choices(yolo_classes, k=num_objects)
            
            bounding_boxes = []
            for obj in objects_detected:
                box = {
                    "label": obj,
                    "confidence": round(random.uniform(0.65, 0.99), 2),
                    "x": random.randint(5, 70),
                    "y": random.randint(5, 70),
                    "width": random.randint(15, 30),
                    "height": random.randint(15, 30),
                    "color": random.choice(["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"])
                }
                bounding_boxes.append(box)

            video_payload = {
                "fps": round(random.uniform(24.0, 30.0), 1),
                "objects_detected": objects_detected,
                "object_count": num_objects,
                "gpu_usage": round(random.uniform(10.0, 65.0), 1),
                "bounding_boxes": bounding_boxes,
                "status": "Active"
            }
            
            # Simulate Audio / Speech
            transcriptions = [
                "Hey Jarvis, what's the system status?",
                "Alert! Motion detected in zone 2.",
                "Starting deployment sequence.",
                "All systems nominal."
            ]
            audio_payload = {
                "transcription": random.choice(transcriptions),
                "sentiment": random.choice(["Positive", "Neutral", "Alert"]),
                "latency_ms": random.randint(15, 80),
                "status": "Active"
            }
            
            # FIX: Correctly formatted NLP payload
            nlp_payload = {
                "tokens_sec": random.randint(120, 450),
                "queue_size": random.randint(0, 5),
                "active_pipelines": random.randint(1, 3),
                "status": "Active"  # <-- FIXED: Properly inside the dictionary!
            }
            
            # System Metrics
            system_payload = {
                "total_inferences": 1500 + self.tick,
                "avg_latency": random.randint(50, 150),
                "success_rate": round(random.uniform(96.0, 99.9), 1)
            }
            
            payload = {
                "video": video_payload,
                "audio": audio_payload,
                "nlp": nlp_payload,
                "system": system_payload,
                "timestamp": self.tick
            }
            
            self.latest_data = payload
            await ws_manager.broadcast("analytics:data", payload)
            await asyncio.sleep(2)

    def stop_stream(self):
        self.is_running = False
        print("\n [MetricsService] Stream stopped.")

    def get_current_state(self):
        """Returns the latest metrics state for Jarvis context"""
        if not self.latest_data:
            return "System is idle. No active streams."
        data = self.latest_data
        return (
            f"Live System Status: "
            f"Vision FPS: {data.get('video', {}).get('fps', 0)}, "
            f"Objects Detected: {data.get('video', {}).get('object_count', 0)}, "
            f"Audio Latency: {data.get('audio', {}).get('latency_ms', 0)}ms, "
            f"Last Transcription: '{data.get('audio', {}).get('transcription', 'N/A')}', "
            f"NLP Tokens/sec: {data.get('nlp', {}).get('tokens_sec', 0)}, "
            f"System Inferences: {data.get('system', {}).get('total_inferences', 0)}, "
            f"Success Rate: {data.get('system', {}).get('success_rate', 0)}%"
        )

metrics_service = MetricsService()