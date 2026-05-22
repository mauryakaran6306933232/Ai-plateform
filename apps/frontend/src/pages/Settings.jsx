import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { monitoringAPI } from '@/lib/api';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import {
  Cpu, HardDrive, Brain, Trash2, RefreshCw, Server, Activity,
  Wifi, WifiOff, User, Shield, Database, Box, Key, CreditCard, Plus, Copy, CheckCircle
} from 'lucide-react';

export default function Settings() {
  const { systemHealth, tokenUsage, activeModel, setActiveModel } = useAppStore();
  const { user, logout } = useAuthStore();
  const [models, setModels] = useState([]);
  const [ollamaStatus, setOllamaStatus] = useState('checking');
  const [isClearing, setIsClearing] = useState(false);
  const [memoryCleared, setMemoryCleared] = useState(false);
  const [isChangingModel, setIsChangingModel] = useState(false);
  
  // NEW: Mock SaaS States
  const [apiKeys, setApiKeys] = useState([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [copiedKey, setCopiedKey] = useState('');

  const fetchModels = async () => {
    setOllamaStatus('checking');
    try {
      const res = await monitoringAPI.ollamaModels();
      setModels(res.data.models || []);
      setOllamaStatus(res.data.status);
    } catch (err) {
      setOllamaStatus('offline');
    }
  };

  const fetchApiKeys = async () => {
    try {
      const res = await monitoringAPI.getApiKeys();
      setApiKeys(res.data.keys || []);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchModels();
    fetchApiKeys();
  }, []);

  const handleModelSelect = async (model) => {
    setIsChangingModel(true);
    try {
      await monitoringAPI.setModel(model);
      setActiveModel(model);
    } catch (err) {
      console.error("Failed to change model:", err);
      alert(err.response?.data?.detail || "Failed to set model.");
    } finally {
      setIsChangingModel(false);
    }
  };

  const handleClearMemory = async () => {
    setIsClearing(true);
    setMemoryCleared(false);
    try {
      await monitoringAPI.clearMemory();
      setMemoryCleared(true);
      setTimeout(() => { window.location.reload(); }, 1500);
    } catch (err) {
      console.error("Failed to clear memory:", err);
    } finally {
      setIsClearing(false);
    }
  };

  const handleGenerateKey = async () => {
    if (!newKeyName.trim()) return;
    try {
      await monitoringAPI.generateApiKey(newKeyName);
      setNewKeyName('');
      fetchApiKeys();
    } catch (err) {
      console.error("Failed to generate key:", err);
    }
  };

  const handleCopyKey = (key) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings & Control Center</h1>
        <p className="text-muted-foreground mt-1">Manage models, memory, and system configuration</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4 text-ai-blue" /> User Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Email</span>
              <span className="font-mono">{user?.email || "Not logged in"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Username</span>
              <span className="font-mono">{user?.username || "N/A"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">User ID</span>
              <span className="font-mono text-xs">#{user?.id || "0"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Role</span>
              <Badge variant="info">Administrator</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tokens Used</span>
              <span className="font-mono text-ai-green">{tokenUsage.total.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-ai-green" /> System Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1"><Cpu className="h-3 w-3" /> CPU</span>
              <span className="font-mono">{systemHealth.cpu}%</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1"><HardDrive className="h-3 w-3" /> Memory</span>
              <span className="font-mono">{systemHealth.memory_used_gb} / {systemHealth.memory_total_gb} GB</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1"><Shield className="h-3 w-3" /> Status</span>
              <Badge variant={systemHealth.status === 'healthy' ? 'success' : 'destructive'}>
                {systemHealth.status === 'healthy' ? 'Healthy' : 'Degraded'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Brain className="h-4 w-4 text-ai-purple" /> AI Model Configuration
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={fetchModels} className="h-6 w-6 p-0">
                <RefreshCw className={`h-3.5 w-3.5 ${ollamaStatus === 'checking' ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <CardDescription className="text-xs">
              Select the default model for Ollama inference
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-muted-foreground">Ollama Server:</span>
              <Badge variant={ollamaStatus === 'connected' ? 'success' : ollamaStatus === 'checking' ? 'warning' : 'destructive'} className="text-[10px]">
                {ollamaStatus === 'connected' ? 'Connected' : ollamaStatus === 'checking' ? 'Checking...' : 'Offline'}
              </Badge>
            </div>
            {models.length === 0 ? (
              <div className="text-xs text-center text-gray-500 py-4">
                {ollamaStatus === 'offline' ? "Start Ollama to see models" : "No models found"}
              </div>
            ) : (
              models.map((model) => (
                <div key={model} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Box className="h-4 w-4 text-ai-purple" />
                    <span className="text-sm font-mono">{model}</span>
                  </div>
                  <Button
                    size="sm"
                    variant={activeModel === model ? 'ai' : 'outline'}
                    onClick={() => handleModelSelect(model)}
                    disabled={isChangingModel}
                  >
                    {isChangingModel && activeModel !== model ? '...' : activeModel === model ? 'Active' : 'Select'}
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4 text-ai-orange" /> Memory Management
            </CardTitle>
            <CardDescription className="text-xs">
              Manage Jarvis's persistent ChromaDB memory
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 p-3 rounded-md text-xs text-muted-foreground">
              <strong>Warning:</strong> Clearing memory is permanent. Jarvis will forget past conversations and preferences.
            </div>
            <Button
              variant="destructive"
              onClick={handleClearMemory}
              disabled={isClearing}
              className="w-full"
            >
              {isClearing ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Clearing...</>
              ) : (
                <><Trash2 className="h-4 w-4 mr-2" /> Clear All Jarvis Memory</>
              )}
            </Button>
            {memoryCleared && (
              <Badge variant="success" className="w-full justify-center py-2">
                Memory Cleared Successfully
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* NEW: Mock SaaS API Keys */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Key className="h-4 w-4 text-ai-cyan" /> API Keys
            </CardTitle>
            <CardDescription className="text-xs">
              Manage API keys for programmatic access
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input 
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Key name (e.g., Production)"
                className="h-8 text-xs bg-background border-gray-700"
              />
              <Button variant="ai" size="sm" onClick={handleGenerateKey} className="h-8 text-xs shrink-0">
                <Plus className="h-3 w-3 mr-1" /> Create
              </Button>
            </div>
            <div className="space-y-2 max-h-[150px] overflow-y-auto">
              {apiKeys.map((k) => (
                <div key={k.key} className="flex items-center justify-between p-2 border border-gray-800 rounded-md bg-black/30">
                  <div>
                    <p className="text-xs font-bold text-gray-300">{k.name}</p>
                    <p className="text-[10px] font-mono text-gray-500">{k.key.substring(0, 20)}...</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleCopyKey(k.key)}>
                    {copiedKey === k.key ? <CheckCircle className="h-3.5 w-3.5 text-ai-green" /> : <Copy className="h-3.5 w-3.5 text-gray-500" />}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* NEW: Mock SaaS Billing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4 text-ai-green" /> Usage & Billing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Plan</span>
              <Badge variant="purple" className="text-[10px]">Enterprise (Local)</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Inference Provider</span>
              <span className="font-mono text-ai-blue">Ollama (Self-Hosted)</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Tokens Used</span>
              <span className="font-mono">{tokenUsage.total.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Estimated Cost</span>
              <span className="font-mono text-ai-green text-lg font-bold">$0.00</span>
            </div>
            <div className="bg-ai-green/10 p-2 rounded-md text-xs text-ai-green flex items-center gap-2">
              <CheckCircle className="h-4 w-4" /> Unlimited local inference. No API rate limits.
            </div>
          </CardContent>
        </Card>

      </div>
    </motion.div>
  );
}