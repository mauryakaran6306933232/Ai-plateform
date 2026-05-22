import asyncio
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from app.websocket_manager import ws_manager
from app.services.metrics_service import metrics_service

logger = logging.getLogger(__name__)

class SchedulerService:
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.jobs = {} # Keep track of active jobs in memory for the API
        
    def start(self):
        if not self.scheduler.running:
            self.scheduler.start()
            logger.info("■ [Scheduler] Background routine scheduler started.")

    def shutdown(self):
        if self.scheduler.running:
            self.scheduler.shutdown()
            logger.info("■ [Scheduler] Background routine scheduler stopped.")

    def add_job(self, job_id: str, task_type: str, interval_minutes: int, condition: str = None) -> dict:
        """Adds a new scheduled routine"""
        # If job already exists, remove it first
        if job_id in self.jobs:
            self.remove_job(job_id)

        # Define the actual function that will run
        async def routine_task():
            if task_type == "system_status":
                state = metrics_service.get_current_state()
                # If a condition is set (e.g., "cpu over 80"), check it. Otherwise, always alert.
                if condition and "cpu" in condition.lower() and "over" in condition.lower():
                    try:
                        threshold = int(''.join(filter(str.isdigit, condition)))
                        cpu_val = float(state.split("CPU: ")[1].split("%")[0])
                        if cpu_val > threshold:
                            await ws_manager.broadcast("jarvis:proactive_alert", {
                                "severity": "warning",
                                "title": f"Scheduled Alert: CPU at {cpu_val}%",
                                "message": f"Your scheduled routine triggered! CPU is above {threshold}%."
                            })
                    except Exception:
                        pass # Condition parsing failed, skip alert
                else:
                    await ws_manager.broadcast("jarvis:proactive_alert", {
                        "severity": "info",
                        "title": "Scheduled System Status",
                        "message": state
                    })

        # Schedule the job
        self.scheduler.add_job(
            routine_task,
            IntervalTrigger(minutes=interval_minutes),
            id=job_id,
            replace_existing=True
        )
        
        # Save job metadata for the UI
        self.jobs[job_id] = {
            "id": job_id,
            "task_type": task_type,
            "interval_minutes": interval_minutes,
            "condition": condition,
            "status": "running"
        }
        logger.info(f"■ [Scheduler] Added job {job_id} running every {interval_minutes} minutes.")
        return self.jobs[job_id]

    def remove_job(self, job_id: str) -> bool:
        """Removes a scheduled routine"""
        if job_id in self.jobs:
            try:
                self.scheduler.remove_job(job_id)
            except Exception:
                pass
            del self.jobs[job_id]
            logger.info(f"■ [Scheduler] Removed job {job_id}.")
            return True
        return False

    def get_jobs(self) -> list:
        """Returns all active jobs"""
        return list(self.jobs.values())

# Singleton
scheduler_service = SchedulerService()