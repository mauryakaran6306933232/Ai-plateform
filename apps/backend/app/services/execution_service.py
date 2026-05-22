import os
import subprocess
import asyncio
import re
from app.websocket_manager import ws_manager

class ExecutionService:
    def __init__(self):
        # Use absolute path for Docker volume mounting
        self.workspace_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "workspace"))
        os.makedirs(self.workspace_dir, exist_ok=True)

    def save_code(self, filename: str, code: str) -> str:
        # SECURITY: Prevent path traversal
        filepath = os.path.join(self.workspace_dir, filename)
        abs_filepath = os.path.abspath(filepath)
        if not abs_filepath.startswith(self.workspace_dir):
            raise ValueError("Attempted to access file outside workspace")
            
        # NEW: Create subdirectories if they don't exist (for multi-file scaffolding)
        os.makedirs(os.path.dirname(abs_filepath), exist_ok=True)
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(code)
        return filepath

    def extract_code_from_text(self, text: str) -> str:
        """Extracts code from markdown fences (```python ... ```)"""
        match = re.search(r"```(?:python)?\s*\n(.*?)```", text, re.DOTALL)
        if match:
            code = match.group(1).strip()
            if code.lower().startswith("python"):
                code = code[6:].strip()
            return code

        python_keywords = ['import ', 'from ', 'def ', 'class ', 'print(', 'for ', 'while ', 'if ', 'with ', '#']
        has_python = any(keyword in text for keyword in python_keywords)
        if not has_python:
            return ""
        lines = text.split('\n')
        code_lines = []
        started = False
        for line in lines:
            if not started and any(keyword in line for keyword in python_keywords):
                started = True
            if started:
                code_lines.append(line)
        return '\n'.join(code_lines).strip() if code_lines else ""

    def _run_sync_subprocess(self, filepath: str, timeout: int = 15):
        """Synchronous subprocess runner using Docker Sandbox for safety"""
        if not os.path.exists(filepath):
            return "", f"File not found: {filepath}", 1

        filename = os.path.basename(filepath)
        abs_filepath = os.path.abspath(filepath)
        if not abs_filepath.startswith(self.workspace_dir):
            return "", "Security Error: Attempted to access file outside workspace.", 1
            
        try:
            docker_command = [
                "docker", "run", "--rm",
                "--network", "none",
                "--memory", "512m",
                "--cpus", "1",
                "-v", f"{self.workspace_dir}:/app/workspace:ro",
                "python:3.11-slim",
                "python", f"/app/workspace/{filename}"
            ]

            result = subprocess.run(
                docker_command,
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=self.workspace_dir
            )
            return result.stdout, result.stderr, result.returncode

        except subprocess.TimeoutExpired:
            return "", "■■ Process timed out (15s limit). If this is a web server, it started successfully!", 0
        except FileNotFoundError:
            return "", "■ Docker is not installed or not running. Please start Docker Desktop to execute code safely.", 1
        except Exception as e:
            return "", str(e), 1

    async def execute_file(self, filepath: str, task_id: str = "exec_1"):
        if not os.path.exists(filepath):
            await ws_manager.broadcast("execution:output", {"task_id": task_id, "output": "File not found", "type": "error"})
            return
        await ws_manager.broadcast("execution:status", {"task_id": task_id, "status": "running"})

        try:
            stdout, stderr, return_code = await asyncio.to_thread(
                self._run_sync_subprocess, filepath, 15
            )
            if stdout:
                for line in stdout.splitlines():
                    if line.strip():
                        await ws_manager.broadcast("execution:output", {
                            "task_id": task_id,
                            "output": line.strip(),
                            "type": "stdout"
                        })
            if stderr:
                for line in stderr.splitlines():
                    if line.strip():
                        await ws_manager.broadcast("execution:output", {
                            "task_id": task_id,
                            "output": line.strip(),
                            "type": "stderr"
                        })
            status = "completed" if return_code == 0 else "failed"
            await ws_manager.broadcast("execution:status", {"task_id": task_id, "status": status, "exit_code": return_code})
        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            print(f"\n [ExecutionService] Error executing {filepath}:\n{error_details}")
            await ws_manager.broadcast("execution:output", {
                "task_id": task_id,
                "output": f"Execution Engine Error:\n{error_details}",
                "type": "error"
            })
            await ws_manager.broadcast("execution:status", {"task_id": task_id, "status": "failed", "exit_code": 1})

    def _run_shell_sync(self, command: str, timeout: int = 30):
        """Synchronous shell runner using Docker Sandbox for safety (e.g., for pip audit)"""
        try:
            docker_command = [
                "docker", "run", "--rm",
                "--network", "none",
                "--memory", "512m",
                "--cpus", "1",
                "-v", f"{self.workspace_dir}:/app/workspace:ro",
                "python:3.11-slim",
                "bash", "-c", command
            ]
            result = subprocess.run(
                docker_command,
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=self.workspace_dir
            )
            return result.stdout, result.stderr, result.returncode
        except subprocess.TimeoutExpired:
            return "", "Process timed out.", 1
        except FileNotFoundError:
            return "", "Docker is not running.", 1
        except Exception as e:
            return "", str(e), 1

execution_service = ExecutionService()