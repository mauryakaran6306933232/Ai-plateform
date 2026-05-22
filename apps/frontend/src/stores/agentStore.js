import { create } from 'zustand';

export const useAgentStore = create((set, get) => ({
  // All agents
  agents: [],
  setAgents: (agents) => set({ agents }),

  // Active workflow
  activeWorkflow: null,
  setActiveWorkflow: (workflow) => set({ activeWorkflow: workflow }),

  // Workflow steps
  workflowSteps: [],
  addWorkflowStep: (step) =>
    set((s) => ({ workflowSteps: [...s.workflowSteps, step] })),
  clearWorkflowSteps: () => set({ workflowSteps: [] }),

  // Agent outputs
  outputs: {},
  addOutput: (agentId, output) =>
    set((s) => ({
      outputs: {
        ...s.outputs,
        [agentId]: [...(s.outputs[agentId] || []), output],
      },
    })),

  // Thinking indicators
  thinking: {},
  setThinking: (agentId, isThinking) =>
    set((s) => ({
      thinking: { ...s.thinking, [agentId]: isThinking },
    })),

  // Execution logs
  logs: [],
  addLog: (log) =>
    set((s) => ({
      logs: [{ id: Date.now(), timestamp: new Date().toISOString(), ...log }, ...s.logs].slice(0, 200),
    })),
  clearLogs: () => set({ logs: [] }),
}));