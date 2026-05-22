import asyncio
import psutil
import time
from app.websocket_manager import ws_manager
import logging

logger = logging.getLogger(__name__)

class ProactiveService:
    def __init__(self):
        self.is_running = False
        self.last_alert_time = {
            "cpu": 0,
            "memory": 0,
            "disk": 0,
        }
        # Cooldown in seconds (5 minutes)
        self.cooldown = 300 
        
        # Thresholds
        self.cpu_threshold = 90.0
        self.memory_threshold = 90.0
        self.disk_threshold = 95.0

    async def start_proactive_loop(self):
        if self.is_running:
            return
        self.is_running = True
        logger.info("■ [Proactive] Jarvis background monitoring started.")

        while self.is_running:
            try:
                now = time.time()
                
                # Check CPU
                cpu_percent = psutil.cpu_percent(interval=1)
                if cpu_percent > self.cpu_threshold and (now - self.last_alert_time["cpu"]) > self.cooldown:
                    await ws_manager.broadcast("jarvis:proactive_alert", {
                        "severity": "critical",
                        "title": "Critical CPU Usage",
                        "message": f"CPU usage has been at {cpu_percent}% for over a minute. Consider closing heavy applications."
                    })
                    self.last_alert_time["cpu"] = now

                # Check Memory
                mem = psutil.virtual_memory()
                if mem.percent > self.memory_threshold and (now - self.last_alert_time["memory"]) > self.cooldown:
                    await ws_manager.broadcast("jarvis:proactive_alert", {
                        "severity": "warning",
                        "title": "High Memory Usage",
                        "message": f"RAM usage is at {mem.percent}%. You might experience slowdowns."
                    })
                    self.last_alert_time["memory"] = now

                # Check Disk
                disk = psutil.disk_usage('/')
                if disk.percent > self.disk_threshold and (now - self.last_alert_time["disk"]) > self.cooldown:
                    await ws_manager.broadcast("jarvis:proactive_alert", {
                        "severity": "warning",
                        "title": "Disk Space Low",
                        "message": f"Disk usage is at {disk.percent}%. Consider cleaning up files."
                    })
                    self.last_alert_time["disk"] = now

                # Wait 15 seconds before checking again
                await asyncio.sleep(15)

            except Exception as e:
                logger.error(f"■ [Proactive] Monitoring error: {e}")
                await asyncio.sleep(30)

    def stop_proactive_loop(self):
        self.is_running = False
        logger.info("■ [Proactive] Jarvis background monitoring stopped.")

# Singleton
proactive_service = ProactiveService()