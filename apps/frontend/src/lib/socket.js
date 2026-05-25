class SocketManager {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 20;
    this.reconnectInterval = 2000;
    this.manualDisconnect = false;
    this.hasConnectedOnce = false;
  }

  getWsUrl() {
    const configured = import.meta.env.VITE_WS_URL;
    if (configured) {
      return configured;
    }
    // Auto-detect from API URL
    const apiUrl = import.meta.env.VITE_API_URL || '';
    if (apiUrl.includes('onrender.com')) {
      const host = apiUrl.replace(/https?:\/\//, '').replace(/\/api$/, '');
      return `wss://${host}/ws`;
    }
    if (apiUrl.includes('://')) {
      const host = apiUrl.replace(/https?:\/\//, '').replace(/\/api$/, '');
      const protocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
      return `${protocol}://${host}/ws`;
    }
    return 'ws://localhost:8000/ws';
  }

  connect() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.manualDisconnect = false;
    this.reconnectAttempts = 0;

    const wsUrl = this.getWsUrl();
    console.log(`[WS] Connecting to ${wsUrl}`);

    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      console.log('[WS] Connected to FastAPI WebSocket');
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
      if (!this.manualDisconnect) {
        if (this.hasConnectedOnce) {
          console.log('[WS] Disconnected. Attempting to reconnect...');
        }
        this.tryReconnect();
      }
    };

    this.socket.onerror = (err) => {
      if (!this.hasConnectedOnce) {
        console.log('[WS] Waiting for backend to start...');
      } else {
        console.error('[WS] Error. Check your backend server.');
      }
    };
  }

  tryReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WS] Max reconnection attempts reached.');
      return;
    }
    this.reconnectAttempts++;
    setTimeout(() => {
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