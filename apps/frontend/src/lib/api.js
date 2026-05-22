import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ai-platform-token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('ai-platform-token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
};

export const agentAPI = {
  list: () => api.get('/agents'),
  get: (id) => api.get(`/agents/${id}`),
  execute: (id, task) => api.post(`/agents/${id}/execute`, { task }),
  runFile: (filename) => api.post('/agents/run-file', { filename }),
  fixCode: (filename, error_output) => api.post('/agents/fix-code', { filename, error_output }),
  stop: (id) => api.post(`/agents/${id}/stop`),
  history: (id) => api.get(`/agents/${id}/history`),
};

export const projectAPI = {
  list: () => api.get('/projects'),
  createPR: (id, data) => api.post(`/projects/${id}/pr`, data),
  get: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  delete: (id) => api.delete(`/projects/${id}`),
  upload: (formData) => api.post('/projects/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  githubClone: (repo_url) => api.post('/projects/github', { repo_url }),
  analyze: (id) => api.post(`/projects/${id}/analyze`),
  search: (id, query) => api.post(`/projects/${id}/search`, { query }),
};

export const workflowAPI = {
  list: () => api.get('/workflows'),
  get: (id) => api.get(`/workflows/${id}`),
  create: (data) => api.post('/workflows', data),
  execute: (id) => api.post(`/workflows/${id}/execute`),
  status: (id) => api.get(`/workflows/${id}/status`),
};

export const jarvisAPI = {
  chat: (message, context, mode) => api.post('/jarvis/chat', { message, context, mode }),
  getHistory: () => api.get('/jarvis/history'),
  saveConversation: (data) => api.post('/jarvis/save', data),
  execute: (command) => api.post('/jarvis/execute', { command }),
  memory: () => api.get('/jarvis/memory'),
  tools: () => api.get('/jarvis/tools'),
  voice: (formData) => api.post('/jarvis/voice', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  // NEW: Upload files directly from Jarvis Chat
  uploadFile: (formData) => api.post('/jarvis/upload-file', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

export const analyticsAPI = {
  dashboard: () => api.get('/analytics/dashboard'),
  startStream: () => api.post('/analytics/stream/start'),
  stopStream: () => api.post('/analytics/stream/stop'),
  alerts: () => api.get('/analytics/alerts'),
  models: () => api.get('/analytics/models'),
  inference: (data) => api.post('/analytics/inference', data),
  transcribeAudio: (formData) => api.post('/analytics/audio/transcribe', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  }),
};

export const memoryAPI = {
  search: (query) => api.post('/memory/search', { query }),
  store: (data) => api.post('/memory/store', data),
  context: (query) => api.post('/memory/context', { query }),
};

export const monitoringAPI = {
  metrics: () => api.get('/monitoring/metrics'),
  tokens: () => api.get('/monitoring/tokens'),
  health: () => api.get('/monitoring/health'),
  ollamaModels: () => api.get('/monitoring/ollama/models'),
  clearMemory: () => api.post('/monitoring/memory/clear'),
  setModel: (model) => api.post('/monitoring/model/set', { model }),
  getActiveModel: () => api.get('/monitoring/model/active'),
  startMetricsStream: () => api.post('/monitoring/stream/start'),
  stopMetricsStream: () => api.post('/monitoring/stream/stop'),
  benchmark: () => api.get('/monitoring/benchmark'),
  getApiKeys: () => api.get('/monitoring/api-keys'),
  generateApiKey: (name) => api.post('/monitoring/api-keys/generate', { name }),
};

export const workspaceAPI = {
  list: () => api.get('/workspace/files'),
  getContent: (filename) => api.get(`/workspace/files/${filename}`),
  update: (filename, content) => api.put(`/workspace/files/${filename}`, { content }),
  delete: (filename) => api.delete(`/workspace/files/${filename}`),
};

export default api;