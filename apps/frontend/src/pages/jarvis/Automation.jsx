import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { jarvisAPI } from '@/lib/api';
import socketManager from '@/lib/socket';
import { Monitor, Bot, Globe, Cpu, Search, FileText, Terminal, Play, Zap, Activity, Send, CheckCircle, AlertCircle, Loader2, Square, StopCircle } from 'lucide-react';

export default function Automation() {
  const [logs, setLogs] = useState([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // NEW: State for Live Output and Stop functionality
  const [outputText, setOutputText] = useState('');
  const isStoppedRef = useRef(false);
  const outputRef = useRef(null);

  const addLog = (source, message, type = 'info') => {
    setLogs(prev => [
      { id: Date.now(), time: new Date().toLocaleTimeString(), source, message, type },
      ...prev
    ].slice(0, 50));
  };

  useEffect(() => {
    const handleJarvisResponse = (data) => {
      // If user stopped the task, ignore incoming WS data
      if (isStoppedRef.current) return;

      if (data.status === 'thinking') {
        setIsExecuting(true);
        addLog('Jarvis', 'Processing action...', 'info');
      } else if (data.status === 'streaming') {
        // Append live text tokens to the output box
        setOutputText(prev => prev + data.token);
      } else if (data.status === 'done') {
        setIsExecuting(false);
        addLog('Jarvis', 'Action completed successfully.', 'success');
      } else if (data.status === 'error') {
        setIsExecuting(false);
        addLog('System', 'Action failed.', 'error');
        setOutputText(prev => prev + "\n\n[ERROR] Action failed to complete.");
      }
    };

    const handleExecStatus = (data) => {
      if (isStoppedRef.current) return;
      addLog('Executor', `Script ${data.status} (Exit: ${data.exit_code})`, data.status === 'completed' ? 'success' : 'error');
      if (data.status === 'completed' || data.status === 'failed') setIsExecuting(false);
    };

    const handleExecOutput = (data) => {
      if (isStoppedRef.current) return;
      // Append script stdout/stderr to the output box
      const prefix = data.type === 'stderr' ? '\n[ERR] ' : '\n';
      setOutputText(prev => prev + prefix + data.output);
    };

    const handleWorkflowStatus = (data) => {
      if (isStoppedRef.current) return;
      if (data.status === 'running') {
        addLog('Workflow', 'Autonomous agent workflow started...', 'info');
        setIsExecuting(true);
      } else if (data.status === 'completed') {
        addLog('Workflow', 'Workflow finished.', 'success');
        setIsExecuting(false);
      }
    };

    const handleAgentStatus = (data) => {
      if (isStoppedRef.current) return;
      if (data.status === 'thinking') {
        addLog(data.agent_id || 'Agent', 'Thinking...', 'info');
      } else if (data.status === 'completed') {
        addLog(data.agent_id || 'Agent', 'Completed.', 'success');
      }
    };

    socketManager.on('jarvis:response', handleJarvisResponse);
    socketManager.on('execution:status', handleExecStatus);
    socketManager.on('execution:output', handleExecOutput);
    socketManager.on('workflow:status', handleWorkflowStatus);
    socketManager.on('agent:status', handleAgentStatus);

    return () => {
      socketManager.off('jarvis:response', handleJarvisResponse);
      socketManager.off('execution:status', handleExecStatus);
      socketManager.off('execution:output', handleExecOutput);
      socketManager.off('workflow:status', handleWorkflowStatus);
      socketManager.off('agent:status', handleAgentStatus);
    };
  }, []);

  // Auto-scroll output box to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [outputText]);

  const triggerAction = async (command) => {
    if (isExecuting) return;
    
    isStoppedRef.current = false; // Reset stop flag
    setIsExecuting(true);
    setOutputText(''); // Clear previous output
    addLog('User', `Triggered: "${command}"`, 'action');
    
    try {
      await jarvisAPI.chat(command);
    } catch (err) {
      addLog('System', 'Failed to send command to backend.', 'error');
      setIsExecuting(false);
    }
  };

  // NEW: Stop currently running task
  const handleStopExecution = () => {
    isStoppedRef.current = true;
    setIsExecuting(false);
    setOutputText(prev => prev + "\n\n[STOPPED BY USER]");
    addLog('System', 'Task stopped by user.', 'warning');
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    triggerAction(`Jarvis, search the web for ${searchQuery}`);
    setSearchQuery('');
  };

  const quickActions = [
    { icon: Cpu, label: "System Status", command: "Jarvis, check the system metrics", color: "blue" },
    { icon: Play, label: "Run Latest Script", command: "Jarvis, run my latest code", color: "green" },
    { icon: Search, label: "Search AI News", command: "Jarvis, search the web for latest AI news", color: "purple" },
    { icon: Monitor, label: "Take Screenshot", command: "Jarvis, take a screenshot", color: "cyan" },
    { icon: Terminal, label: "Open Search", command: "Jarvis, open system search", color: "orange" },
  ];

  const engines = [
    { name: "Playwright Browser", status: "Active", desc: "Headless Chromium", icon: Globe, color: "blue" },
    { name: "Python Executor", status: "Active", desc: "Sandboxed Subprocess", icon: Terminal, color: "green" },
    { name: "Ollama LLM", status: "Active", desc: "Llama3 Local Inference", icon: Bot, color: "purple" },
    { name: "ChromaDB Memory", status: "Active", desc: "Persistent Vector Store", icon: Activity, color: "cyan" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Automation & Actions</h1>
          <p className="text-muted-foreground mt-1">
            Real-time control panel for Jarvis automation engine
          </p>
        </div>
        <div className="flex gap-3 items-center">
          {isExecuting && (
            <Badge variant="info" className="animate-pulse py-1 px-3">
              <Loader2 className="h-3 w-3 mr-2 animate-spin" /> Processing
            </Badge>
          )}
          {/* NEW: STOP BUTTON */}
          {isExecuting && (
            <Button variant="destructive" size="sm" onClick={handleStopExecution}>
              <Square className="h-4 w-4 mr-2" /> Stop Task
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Quick Actions */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4 text-ai-orange" /> Quick Actions
            </CardTitle>
            <CardDescription>Trigger Jarvis actions instantly</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {quickActions.map((action) => (
                <Button
                  key={action.label}
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-muted/50 border-gray-700 dark:border-gray-800 whitespace-normal text-center"
                  onClick={() => triggerAction(action.command)}
                  disabled={isExecuting}
                >
                  <div className={`rounded-lg p-2 bg-ai-${action.color}/10`}>
                    <action.icon className={`h-5 w-5 text-ai-${action.color}`} />
                  </div>
                  <span className="text-xs font-medium">{action.label}</span>
                </Button>
              ))}
            </div>
            
            {/* Custom Search Bar */}
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search the web for anything..."
                  className="pl-10 bg-background"
                  disabled={isExecuting}
                />
              </div>
              <Button type="submit" variant="ai" disabled={isExecuting || !searchQuery.trim()}>
                <Globe className="h-4 w-4 mr-2" /> Search
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Engine Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Monitor className="h-4 w-4 text-ai-cyan" /> Engines
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {engines.map((engine) => (
              <div key={engine.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <engine.icon className={`h-4 w-4 text-ai-${engine.color}`} />
                  <div>
                    <p className="text-sm font-medium">{engine.name}</p>
                    <p className="text-[10px] text-muted-foreground">{engine.desc}</p>
                  </div>
                </div>
                <Badge variant="success" className="text-[10px]">{engine.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* NEW: LIVE OUTPUT TERMINAL */}
      <Card className="border-ai-green/30 bg-[#0d1117]">
        <CardHeader className="flex flex-row items-center justify-between border-b border-gray-800 pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-gray-300">
            <Terminal className="h-4 w-4 text-ai-green" /> Live Output
          </CardTitle>
          <div className="flex gap-2">
            {isExecuting && (
              <Badge variant="outline" className="text-ai-green border-ai-green/30 animate-pulse text-[10px]">
                <Activity className="h-3 w-3 mr-1"/> Streaming
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={() => setOutputText('')} className="text-gray-500 hover:text-gray-300 h-6 text-xs">
              Clear
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div ref={outputRef} className="h-[300px] w-full overflow-y-auto p-4 font-mono text-sm text-gray-300 whitespace-pre-wrap">
            {outputText === '' ? (
              <div className="text-gray-600 text-center py-10">
                Trigger an action to see live Jarvis output and script results here...
              </div>
            ) : (
              outputText
            )}
            {isExecuting && <span className="inline-block w-2 h-4 bg-ai-green animate-pulse ml-1 -mb-1"></span>}
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Activity Log */}
      <Card className="bg-[#0d1117] border-gray-800">
        <CardHeader className="flex flex-row items-center justify-between border-b border-gray-800 pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-gray-300">
            <FileText className="h-4 w-4 text-ai-blue" /> System Logs
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setLogs([])} className="text-gray-500 hover:text-gray-300">
            Clear
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[250px] w-full">
            <div className="p-4 font-mono text-xs space-y-2">
              {logs.length === 0 ? (
                <div className="text-gray-600 text-center py-10">
                  System events will appear here...
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="flex gap-3 items-start">
                    <span className="text-gray-600 shrink-0 w-16">{log.time}</span>
                    <Badge
                      variant={
                        log.type === 'success' ? 'success' :
                        log.type === 'error' ? 'destructive' :
                        log.type === 'action' ? 'info' : 
                        log.type === 'warning' ? 'warning' : 'outline'
                      }
                      className="h-5 text-[9px] shrink-0 justify-center w-20"
                    >
                      {log.source}
                    </Badge>
                    <span className={
                      log.type === 'success' ? 'text-ai-green' :
                      log.type === 'error' ? 'text-ai-red' :
                      log.type === 'action' ? 'text-ai-blue' :
                      log.type === 'warning' ? 'text-ai-orange' :
                      'text-gray-400'
                    }>
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}