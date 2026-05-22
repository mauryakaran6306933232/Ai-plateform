import time
import logging
from collections import deque

logger = logging.getLogger(__name__)

class BenchmarkService:
    def __init__(self, max_records=100):
        self.records = deque(maxlen=max_records)

    def add_record(self, model: str, tokens: int, duration_sec: float):
        tokens_per_sec = round(tokens / duration_sec, 2) if duration_sec > 0 else 0
        record = {
            "model": model,
            "tokens": tokens,
            "duration_sec": round(duration_sec, 2),
            "tokens_per_sec": tokens_per_sec,
            "timestamp": time.time()
        }
        self.records.append(record)
        logger.info(f"[Benchmark] {model}: {tokens_per_sec} tok/sec ({tokens} tokens in {duration_sec}s)")

    def get_stats(self):
        if not self.records:
            return {"avg_tokens_per_sec": 0, "total_requests": 0, "models": {}, "recent": []}
        
        total_tps = sum(r['tokens_per_sec'] for r in self.records)
        avg_tps = total_tps / len(self.records)
        
        models = {}
        for r in self.records:
            if r['model'] not in models:
                models[r['model']] = {"requests": 0, "total_tokens": 0, "avg_tps": 0, "total_tps_sum": 0}
            models[r['model']]["requests"] += 1
            models[r['model']]["total_tokens"] += r["tokens"]
            models[r['model']]["total_tps_sum"] += r["tokens_per_sec"]
        
        for m in models:
            models[m]["avg_tps"] = round(models[m]["total_tps_sum"] / models[m]["requests"], 2)

        return {
            "avg_tokens_per_sec": round(avg_tps, 2),
            "total_requests": len(self.records),
            "models": models,
            "recent": list(self.records)
        }

benchmark_service = BenchmarkService()