import { create } from 'zustand';
import socketManager from '@/lib/socket';

export const useAppStore = create((set, get) => ({
  user: null,
  sidebarOpen: true,
  activeProject: null,
  agents: {},
  messages: [],
  activeModel: 'llama3',
  tokenUsage: { input: 0, output: 0, total: 0 },
  systemHealth: {
    cpu: 0, memory: 0, disk: 0, gpu: 0,
    memory_used_gb: 0, memory_total_gb: 0,
    gpu_vram_used_gb: 0, gpu_vram_total_gb: 0,
    uptime_seconds: 0, status: 'healthy'
  },
  notifications: [],
  theme: 'dark',
  commandPaletteOpen: false,
  
  // FIX: Global Agent States (Live across all pages)
  agentStates: {
    planner: 'idle',
    coder: 'idle',
    security: 'idle',
    tester: 'idle',
    reviewer: 'idle',
    refactor: 'idle'
  },
  setAgentStates: (newStates) => set({ agentStates: newStates }),
  updateAgentState: (agentId, status) => set((state) => ({
    agentStates: { ...state.agentStates, [agentId]: status }
  })),
  resetAgentStates: () => set({
    agentStates: {
      planner: 'idle',
      coder: 'idle',
      security: 'idle',
      tester: 'idle',
      reviewer: 'idle',
      refactor: 'idle'
    }
  }),

  setUser: (user) => set({ user }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setActiveProject: (project) => set({ activeProject: project }),
  updateAgent: (id, data) => set((s) => ({ agents: { ...s.agents, [id]: { ...s.agents[id], ...data } } })),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  clearMessages: () => set({ messages: [] }),
  setTokenUsage: (usage) => set({ tokenUsage: usage }),
  setActiveModel: (model) => set({ activeModel: model }),
  setSystemHealth: (health) => set({ systemHealth: { ...get().systemHealth, ...health } }),

  addNotification: (notif) => set((s) => ({
    notifications: [{ id: Date.now(), timestamp: new Date().toISOString(), ...notif }, ...s.notifications].slice(0, 50)
  })),

  setTheme: (theme) => {
    set({ theme });
    document.documentElement.classList.toggle('dark', theme === 'dark');
  },

  setCommandPaletteOpen: (isOpen) => set({ commandPaletteOpen: isOpen }),
  toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
}));

// ==========================================
// GLOBAL WEBSOCKET LISTENERS
// ==========================================

// Subscribe to real-time system metrics
socketManager.on('system:metrics', (data) => {
  useAppStore.getState().setSystemHealth({
    cpu: data.cpu_percent, memory: data.memory_percent,
    memory_used_gb: data.memory_used_gb, memory_total_gb: data.memory_total_gb,
    disk: data.disk_percent, gpu: data.gpu_percent,
    gpu_vram_used_gb: data.gpu_vram_used_gb, gpu_vram_total_gb: data.gpu_vram_total_gb,
    uptime_seconds: data.uptime_seconds, status: 'healthy'
  });
});

// Subscribe to Proactive Alerts
socketManager.on('system:alert', (data) => {
  useAppStore.getState().addNotification(data);
});

// Subscribe to Jarvis's own proactive alerts
socketManager.on('jarvis:proactive_alert', (data) => {
  useAppStore.getState().addNotification({
    title: `Jarvis: ${data.title}`,
    message: data.message,
    type: data.severity
  });
});

// FIX: Subscribe to Agent Status (Makes Agents page live)
socketManager.on('agent:status', (data) => {
  if (data.agent_id && data.status) {
    useAppStore.getState().updateAgentState(data.agent_id, data.status);
  }
});

// FIX: Subscribe to Workflow Status (Resets agents when done)
socketManager.on('workflow:status', (data) => {
  if (data.status === 'completed' || data.status === 'failed') {
    useAppStore.getState().resetAgentStates();
  }
});