import asyncio
import psutil
import platform
from datetime import datetime
from app.websocket_manager import ws_manager

class MetricsStreamService:
    def __init__(self):
        self.is_running = False
        self.start_time = datetime.now()
        self.last_alert_time = {} # Prevent alert spam

    async def start_system_stream(self):
        if self.is_running:
            return
        self.is_running = True
        print("\n [MetricsStreamService] Starting real-time system metrics stream...")

        while self.is_running:
            try:
                cpu_percent = psutil.cpu_percent(interval=0.5)
                mem = psutil.virtual_memory()
                disk = psutil.disk_usage("/")
                uptime_seconds = int((datetime.now() - self.start_time).total_seconds())

                gpu_percent = 0
                gpu_vram_used_gb = 0.0
                gpu_vram_total_gb = 0.0
                try:
                    import pynvml
                    pynvml.nvmlInit()
                    handle = pynvml.nvmlDeviceGetHandleByIndex(0)
                    util = pynvml.nvmlDeviceGetUtilizationRates(handle)
                    mem_info = pynvml.nvmlDeviceGetMemoryInfo(handle)
                    gpu_percent = util.gpu
                    gpu_vram_used_gb = round(mem_info.used / (1024**3), 1)
                    gpu_vram_total_gb = round(mem_info.total / (1024**3), 1)
                    pynvml.nvmlShutdown()
                except Exception:
                    pass

                payload = {
                    "cpu_percent": cpu_percent,
                    "memory_percent": mem.percent,
                    "memory_used_gb": round(mem.used / (1024**3), 1),
                    "memory_total_gb": round(mem.total / (1024**3), 1),
                    "disk_percent": disk.percent,
                    "gpu_percent": gpu_percent,
                    "gpu_vram_used_gb": gpu_vram_used_gb,
                    "gpu_vram_total_gb": gpu_vram_total_gb,
                    "platform": platform.system(),
                    "python_version": platform.python_version(),
                    "uptime_seconds": uptime_seconds,
                    "timestamp": datetime.utcnow().isoformat()
                }

                await ws_manager.broadcast("system:metrics", payload)
                
                # PROACTIVE ALERTING LOGIC
                now = datetime.now()
                if cpu_percent > 85 and (now - self.last_alert_time.get('cpu', datetime.min)).total_seconds() > 60:
                    await ws_manager.broadcast("system:alert", {
                        "type": "warning",
                        "title": "High CPU Usage",
                        "message": f"CPU usage is at {cpu_percent}%"
                    })
                    self.last_alert_time['cpu'] = now
                    
                if mem.percent > 85 and (now - self.last_alert_time.get('mem', datetime.min)).total_seconds() > 60:
                    await ws_manager.broadcast("system:alert", {
                        "type": "warning",
                        "title": "High Memory Usage",
                        "message": f"Memory usage is at {mem.percent}%"
                    })
                    self.last_alert_time['mem'] = now

                await asyncio.sleep(2)

            except Exception as e:
                print(f"\n [MetricsStreamService] Error: {e}")
                await asyncio.sleep(5)

    def stop_system_stream(self):
        self.is_running = False

metrics_stream_service = MetricsStreamService()