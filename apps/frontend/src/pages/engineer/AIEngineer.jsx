import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AgentConsole from '@/components/agents/AgentConsole';
import WorkflowVisualizer from '@/components/agents/WorkflowVisualizer';
import WorkspaceExplorer from '@/components/agents/WorkspaceExplorer';
import CodebaseUploader from '@/components/agents/CodebaseUploader';
import { agentAPI, projectAPI } from '@/lib/api';
import socketManager from '@/lib/socket';
import mermaid from 'mermaid';
import { Bot, Play, Terminal, RefreshCw, GitBranch, Network, Square, Shield, TestTube } from 'lucide-react';

mermaid.initialize({ startOnLoad: true, theme: 'dark', themeVariables: { primaryColor: '#3b82f6', primaryTextColor: '#fff', primaryBorderColor: '#1e293b', lineColor: '#64748b', secondaryColor: '#1e1e2e', tertiaryColor: '#0d1117' } });

// FIX: Added all 6 agents in the pipeline
const agents = [
  { name: 'Planner', color: 'blue', desc: 'Breaks down tasks', status: 'active' },
  { name: 'Coder', color: 'purple', desc: 'Generates & fixes code', status: 'active' },
  { name: 'Security', color: 'red', desc: 'CVEs & Secret Scanning', status: 'idle' },
  { name: 'Tester', color: 'yellow', desc: 'Generates & runs Pytest', status: 'idle' },
  { name: 'Reviewer', color: 'orange', desc: 'Security & Quality Review', status: 'idle' },
  { name: 'Refactor', color: 'green', desc: 'Optimizes code', status: 'idle' },
];

export default function AIEngineer() {
  const [task, setTask] = useState("write a python fastapi backend for a todo app with sqlite");
  const [isRunning, setIsRunning] = useState(false);
  const [savedFile, setSavedFile] = useState(null);
  const [terminalOutput, setTerminalOutput] = useState([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastError, setLastError] = useState("");
  const [isCreatingPR, setIsCreatingPR] = useState(false);
  
  // FIX: Added security and tester to agentStates
  const [agentStates, setAgentStates] = useState({
    planner: 'pending', coder: 'pending', security: 'pending', tester: 'pending', reviewer: 'pending', refactor: 'pending'
  });
  
  const [activeProject, setActiveProject] = useState(null);
  const [mermaidCode, setMermaidCode] = useState('');
  const mermaidRef = useRef(null);

  useEffect(() => {
    if (mermaidCode && mermaidRef.current) {
      mermaid.render('mermaidGraph', mermaidCode).then(({ svg }) => {
        mermaidRef.current.innerHTML = svg;
      }).catch(e => console.error("Mermaid render error:", e));
    }
  }, [mermaidCode]);

  useEffect(() => {
    const handleFileReady = (data) => {
      if (data.filename) {
        setSavedFile(data);
        setLastError("");
      }
    };

    const handleExecStatus = (data) => {
      if (data.status === 'running') setIsExecuting(true);
      if (data.status === 'completed' || data.status === 'failed') setIsExecuting(false);
      const exitCode = (data.exit_code !== undefined && data.exit_code !== null) ? data.exit_code : 'N/A';
      setTerminalOutput(prev => [...prev, `>> Process ${data.status} (Exit Code: ${exitCode})`]);
      if (data.status === 'failed') setLastError("Process failed");
      else if (data.status === 'completed') setLastError("");
    };

    const handleExecOutput = (data) => {
      const prefix = data.type === 'stderr' ? '■ ' : '<< ';
      setTerminalOutput(prev => [...prev, prefix + data.output]);
      if (data.type === 'stderr' || data.type === 'error') {
        setLastError(prev => prev + data.output + "\n");
      }
    };

    const handleWorkflowStatus = (data) => {
      if (data.status === 'completed' || data.status === 'failed') setIsRunning(false);
    };

    const handleAgentStatus = (data) => {
      if (data.agent_id && data.status) {
        setAgentStates(prev => ({ ...prev, [data.agent_id]: data.status }));
      }
    };

    const handleMermaidDiagram = (data) => {
      if (data.code) {
        setMermaidCode(data.code);
      }
    };

    socketManager.on('execution:file_ready', handleFileReady);
    socketManager.on('execution:status', handleExecStatus);
    socketManager.on('execution:output', handleExecOutput);
    socketManager.on('workflow:status', handleWorkflowStatus);
    socketManager.on('agent:status', handleAgentStatus);
    socketManager.on('workflow:mermaid_diagram', handleMermaidDiagram);

    return () => {
      socketManager.off('execution:file_ready', handleFileReady);
      socketManager.off('execution:status', handleExecStatus);
      socketManager.off('execution:output', handleExecOutput);
      socketManager.off('workflow:status', handleWorkflowStatus);
      socketManager.off('agent:status', handleAgentStatus);
      socketManager.off('workflow:mermaid_diagram', handleMermaidDiagram);
    };
  }, []);

  const executeTask = async () => {
    if (!task) return;
    setIsRunning(true);
    setSavedFile(null);
    setTerminalOutput([]);
    setLastError("");
    setMermaidCode(""); 
    // FIX: Reset all 6 agents
    setAgentStates({ planner: 'pending', coder: 'pending', security: 'pending', tester: 'pending', reviewer: 'pending', refactor: 'pending' });
    
    agentAPI.execute('full_stack', task)
      .then(() => console.log("■ Task triggered"))
      .catch(err => {
        console.error("■ Failed to trigger task:", err.message);
        setIsRunning(false);
      });
  };

  // FIX: NEW Stop Workflow Function
  const stopWorkflow = () => {
    setIsRunning(false);
    setIsExecuting(false);
    setAgentStates({ planner: 'pending', coder: 'pending', security: 'pending', tester: 'pending', reviewer: 'pending', refactor: 'pending' });
    setTerminalOutput(prev => [...prev, ">> ⚠️ WORKFLOW STOPPED BY USER"]);
  };

  const runSavedFile = async () => {
    if (!savedFile || isExecuting) return;
    setTerminalOutput(prev => [...prev, `>> Executing ${savedFile.filename}...`]);
    setLastError("");
    setIsExecuting(true);
    agentAPI.runFile(savedFile.filename)
      .then(() => console.log("■ Run file triggered"))
      .catch(err => {
        console.error("■ Failed to run file:", err.message);
        setIsExecuting(false);
      });
  };

  const autoFixCode = async () => {
    if (!savedFile || !lastError) return;
    setTerminalOutput(prev => [...prev, `>> ■ Asking AI to fix ${savedFile.filename}...`]);
    setLastError("");
    setIsRunning(true);
    agentAPI.fixCode(savedFile.filename, lastError).catch(err => console.error("Fix error:", err));
  };

  const handleProjectAnalyzed = (project) => {
    setActiveProject(project);
  };

  const createPullRequest = async () => {
    if (!savedFile || !activeProject) {
      alert("Need an active project context and a saved file to create a PR");
      return;
    }
    setIsCreatingPR(true);
    setTerminalOutput(prev => [...prev, `>> Opening Pull Request for ${savedFile.filename}...`]);
    try {
      const res = await projectAPI.createPR(activeProject.id, {
        filename: savedFile.filename,
        branch_name: `ai-platform/${savedFile.filename.replace('.py', '')}`,
        commit_message: `feat: Add ${savedFile.filename}`,
        pr_title: `AI Platform: Add ${savedFile.filename}`
      });
      setTerminalOutput(prev => [...prev, `<< PR Created Successfully: ${res.data.pr_url}`]);
    } catch (err) {
      setTerminalOutput(prev => [...prev, `!! PR Failed: ${err.response?.data?.detail || err.message}`]);
    } finally {
      setIsCreatingPR(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Autonomous AI Engineer</h1>
          <p className="text-muted-foreground mt-1">Writes, executes, and self-heals code locally</p>
        </div>
        {activeProject && (
          <Badge variant="success" className="py-1 px-3">
            Context Loaded: {activeProject.name}
          </Badge>
        )}
      </div>

      {/* Task Input */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Input
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="Enter your software engineering task..."
              className="flex-1 text-base bg-background"
              onKeyDown={(e) => e.key === 'Enter' && !isRunning && executeTask()}
            />
            {/* FIX: Added Stop button */}
            {isRunning ? (
              <Button variant="destructive" onClick={stopWorkflow}>
                <Square className="h-4 w-4 mr-2" /> Stop Task
              </Button>
            ) : (
              <Button variant="ai" onClick={executeTask} disabled={!task}>
                <Play className="h-4 w-4 mr-2" /> Execute Task
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Workflow Visualizer */}
      <WorkflowVisualizer agentStates={agentStates} />

      {/* Mermaid Architecture Diagram */}
      {mermaidCode && (
        <Card className="border-ai-blue/20 bg-[#0d1117]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-gray-300">
              <Network className="h-4 w-4 text-ai-blue" /> AI-Generated Architecture Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div ref={mermaidRef} className="flex justify-center bg-[#1e1e2e] p-4 rounded-md min-h-[150px]"></div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <AgentConsole />
          {/* Execution Terminal */}
          {(savedFile || terminalOutput.length > 0) && (
            <Card className="border-ai-green/30 bg-[#0d1117]">
              <CardHeader className="flex flex-row items-center justify-between border-b border-gray-800 pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-gray-300">
                  <Terminal className="h-4 w-4 text-ai-green" /> Execution Terminal
                </CardTitle>
                <div className="flex gap-2">
                  {lastError && savedFile && (
                    <Button variant="outline" size="sm" onClick={autoFixCode} disabled={isRunning || isExecuting} className="text-ai-orange border-ai-orange/30">
                      <RefreshCw className="h-3 w-3 mr-2 text-ai-orange"/> Auto-Fix Error
                    </Button>
                  )}
                  {savedFile && activeProject && (
                    <Button variant="outline" size="sm" onClick={createPullRequest} disabled={isCreatingPR || isRunning} className="text-ai-purple border-ai-purple/30">
                      <GitBranch className="h-3 w-3 mr-2 text-ai-purple"/> {isCreatingPR ? 'Opening PR...' : 'Create PR'}
                    </Button>
                  )}
                  {savedFile && (
                    <Button variant="outline" size="sm" onClick={runSavedFile} disabled={isExecuting || isRunning} className="text-ai-green border-ai-green/30">
                      <Play className="h-3 w-3 mr-2 text-ai-green"/> Run {savedFile.filename}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4 font-mono text-xs text-gray-400 h-[200px] overflow-y-auto">
                {savedFile && (
                  <div className="text-ai-cyan mb-2">■ {savedFile.message}</div>
                )}
                {terminalOutput.map((line, idx) => (
                  <div key={idx} className={line.startsWith('■') || line.startsWith('!!') || line.includes('STOPPED') ? 'text-ai-red' : line.startsWith('<<') ? 'text-gray-300' : 'text-gray-500'}>
                    {line}
                  </div>
                ))}
                {isExecuting && <div className="animate-pulse text-ai-green mt-2">■ Executing...</div>}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          {/* FIX: Render all 6 agent cards */}
          {agents.map((agent) => (
            <Card key={agent.name} className="hover:border-ai-blue/30 transition-all group">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className={`rounded-lg p-2 bg-ai-${agent.color}/10`}>
                    {agent.name === 'Security' ? <Shield className={`h-4 w-4 text-ai-${agent.color}`} /> :
                     agent.name === 'Tester' ? <TestTube className={`h-4 w-4 text-ai-${agent.color}`} /> :
                     <Bot className={`h-4 w-4 text-ai-${agent.color}`} />}
                  </div>
                  <Badge variant={agent.status === 'active' ? 'success' : 'secondary'}>
                    {agent.status}
                  </Badge>
                </div>
                <CardTitle className="text-base mt-2">{agent.name} Agent</CardTitle>
                <CardDescription className="text-xs">{agent.desc}</CardDescription>
              </CardHeader>
            </Card>
          ))}
          {/* Codebase Uploader */}
          <CodebaseUploader onProjectAnalyzed={handleProjectAnalyzed} />
        </div>
      </div>

      {/* Workspace File Explorer / Editor / Diff */}
      <WorkspaceExplorer />
    </motion.div>
  );
}