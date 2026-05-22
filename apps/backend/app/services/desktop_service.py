import asyncio
import logging
import os
import time
from app.services.execution_service import execution_service

logger = logging.getLogger(__name__)

# SAFELY IMPORT PYAUTOGUI - Prevents server crash on headless machines
PYAUTOGUI_AVAILABLE = False
try:
    import pyautogui
    pyautogui.FAILSAFE = True 
    pyautogui.PAUSE = 0.2 
    PYAUTOGUI_AVAILABLE = True
    logger.info("■ [Desktop] PyAutoGUI loaded successfully.")
except Exception as e:
    logger.warning(f"■■ [Desktop] PyAutoGUI failed to import (headless mode or no display): {e}")

class DesktopService:
    def __init__(self):
        self.is_running = False

    async def take_screenshot(self) -> tuple:
        """Takes a screenshot and saves it to the AI workspace. Returns (filename, filepath)"""
        if not PYAUTOGUI_AVAILABLE:
            raise Exception("PyAutoGUI is not available. Cannot take screenshot (likely no display server).")

        def _take_sync():
            filename = f"screenshot_{int(time.time())}.png"
            screenshot = pyautogui.screenshot()
            filepath = os.path.join(execution_service.workspace_dir, filename)
            screenshot.save(filepath)
            return filename, filepath

        logger.info("[Desktop] Taking screenshot...")
        filename, filepath = await asyncio.to_thread(_take_sync)
        logger.info(f"[Desktop] Screenshot saved to: {filepath}")
        return filename, filepath

    async def move_mouse(self, x: int, y: int):
        if not PYAUTOGUI_AVAILABLE: raise Exception("PyAutoGUI not available")
        logger.info(f"[Desktop] Moving mouse to ({x}, {y})")
        await asyncio.to_thread(pyautogui.moveTo, x, y, duration=0.5)

    async def click(self, x: int = None, y: int = None, button: str = 'left'):
        if not PYAUTOGUI_AVAILABLE: raise Exception("PyAutoGUI not available")
        logger.info(f"[Desktop] Clicking {button} at ({x}, {y})")
        await asyncio.to_thread(pyautogui.click, x=x, y=y, button=button)

    async def type_text(self, text: str):
        if not PYAUTOGUI_AVAILABLE: raise Exception("PyAutoGUI not available")
        logger.info(f"[Desktop] Typing text: {text[:30]}...")
        await asyncio.to_thread(pyautogui.typewrite, text, interval=0.05)

    async def press_key(self, key: str):
        if not PYAUTOGUI_AVAILABLE: raise Exception("PyAutoGUI not available")
        logger.info(f"[Desktop] Pressing key: {key}")
        await asyncio.to_thread(pyautogui.press, key)

    async def hotkey(self, *keys):
        if not PYAUTOGUI_AVAILABLE: raise Exception("PyAutoGUI not available")
        logger.info(f"[Desktop] Hotkey: {keys}")
        await asyncio.to_thread(pyautogui.hotkey, *keys)

# Singleton
desktop_service = DesktopService()