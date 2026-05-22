from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict
import json
from datetime import datetime

class WebSocketManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket

    def disconnect(self, client_id: str):
        self.active_connections.pop(client_id, None)

    async def send_personal(self, client_id: str, event: str, data: dict):
        ws = self.active_connections.get(client_id)
        if ws:
            await ws.send_json({'event': event, 'data': data, 'timestamp': datetime.utcnow().isoformat()})

    async def broadcast(self, event: str, data: dict):
        msg = json.dumps({'event': event, 'data': data, 'timestamp': datetime.utcnow().isoformat()})
        for cid, ws in list(self.active_connections.items()):
            try: await ws.send_text(msg)
            except: self.disconnect(cid)

    async def websocket_endpoint(self, websocket: WebSocket):
        import uuid
        client_id = str(uuid.uuid4())
        await self.connect(websocket, client_id)
        try:
            while True:
                data = await websocket.receive_json()
                event = data.get('event', '')
                
                # ==========================================
                # NEW: VISION PIPELINE INTEGRATION
                # ==========================================
                if event == "vision:alert":
                    # The frontend detected something important (e.g., "Angry Face")
                    alert_data = data.get('data', {})
                    label = alert_data.get("label", "Unknown")
                    confidence = alert_data.get("confidence", 0)
                    
                    # Broadcast as a Jarvis Proactive Alert to all connected clients
                    await self.broadcast("jarvis:proactive_alert", {
                        "severity": "warning",
                        "title": f"🚨 Vision Alert: {label.capitalize()} Detected",
                        "message": f"The live camera detected a {label} with {confidence}% confidence."
                    })
                else:
                    # Default echo behavior for other events
                    await self.send_personal(client_id, event, {'echo': data.get('data', {})})
                    
        except WebSocketDisconnect:
            self.disconnect(client_id)

ws_manager = WebSocketManager()