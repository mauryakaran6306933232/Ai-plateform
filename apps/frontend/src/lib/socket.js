class SocketManager {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 20;
    this.reconnectInterval = 2000; // 2 seconds
    this.manualDisconnect = false; 
    this.hasConnectedOnce = false; // Track if we've ever connected
  }

  connect() {
    // If already connected or currently connecting, do nothing
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) return;

    this.manualDisconnect = false; 
    this.reconnectAttempts = 0;    

    this.socket = new WebSocket('ws://localhost:8000/ws');

    this.socket.onopen = () => {
      console.log('[WS] ✅ Connected to FastAPI WebSocket');
      this.reconnectAttempts = 0; 
      this.hasConnectedOnce = true;
    };

    this.socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const eventName = msg.event;

        if (this.listeners.has(eventName)) {
          this.listeners.get(eventName).forEach(cb => cb(msg.data));
        }
      } catch (e) {
        console.error('[WS] Failed to parse message', e);
      }
    };

    this.socket.onclose = (event) => {
      // Only log and reconnect if it wasn't a manual disconnect
      if (!this.manualDisconnect) {
        // Don't log scary errors if we've never connected (backend is probably just booting up)
        if (this.hasConnectedOnce) {
          console.log('[WS] Disconnected. Attempting to reconnect...');
        }
        this.tryReconnect();
      }
    };

    this.socket.onerror = (err) => {
      // Suppress scary red console errors on cold start
      if (!this.hasConnectedOnce) {
        console.log('[WS] Waiting for backend to start...');
      } else {
        console.error('[WS] Error. Is the backend running on http://localhost:8000?');
      }
    };
  }

  tryReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WS] Max reconnection attempts reached. Please check your backend server.');
      return;
    }

    this.reconnectAttempts++;
    setTimeout(() => {
      // console.log(`[WS] Reconnect attempt ${this.reconnectAttempts}...`); // Optional: can be noisy
      this.connect();
    }, this.reconnectInterval);
  }

  disconnect() {
    this.manualDisconnect = true; 
    if (this.socket) {
      this.socket.close();
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ event, data }));
    }
  }
}

export const socketManager = new SocketManager();
export default socketManager;