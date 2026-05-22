import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { workflowAPI, agentAPI } from '@/lib/api';
import {
 Workflow, Plus, Play, Loader2, Trash2, ChevronDown, ChevronUp,
 Bot, Brain, Shield, Sparkles, Save, X, TestTube, Eye
} from 'lucide-react';

// FIX: Updated to include all 6 agents in the pipeline
const agentOptions = [
  { id: 'planner', name: 'Planner', icon: Brain, color: 'blue' },
  { id: 'coder', name: 'Coder', icon: Bot, color: 'purple' },
  { id: 'security', name: 'Security', icon: Shield, color: 'red' },      // ADDED
  { id: 'tester', name: 'Tester', icon: TestTube, color: 'yellow' },     // ADDED
  { id: 'reviewer', name: 'Reviewer', icon: Eye, color: 'orange' },      // FIXED
  { id: 'refactor', name: 'Refactor', icon: Sparkles, color: 'green' },  // FIXED
];

export default function Workflows() {
  const [workflows, setWorkflows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isExecuting, setIsExecuting] = useState(null);

  const [newWorkflow, setNewWorkflow] = useState({
    name: '',
    description: '',
    steps: [{ agent: 'coder', description: '' }]
  });

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = async () => {
    try {
      const res = await workflowAPI.list();
      setWorkflows(res.data.workflows || []);
    } catch (err) {
      console.error("Failed to fetch workflows:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddStep = () => {
    setNewWorkflow(prev => ({
      ...prev,
      steps: [...prev.steps, { agent: 'coder', description: '' }]
    }));
  };

  const handleRemoveStep = (index) => {
    setNewWorkflow(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index)
    }));
  };

  const handleStepChange = (index, field, value) => {
    setNewWorkflow(prev => {
      const steps = [...prev.steps];
      steps[index] = { ...steps[index], [field]: value };
      return { ...prev, steps };
    });
  };

  const handleCreateWorkflow = async () => {
    if (!newWorkflow.name.trim()) return;
    try {
      await workflowAPI.create(newWorkflow);
      setNewWorkflow({ name: '', description: '', steps: [{ agent: 'coder', description: '' }] });
      setShowForm(false);
      fetchWorkflows();
    } catch (err) {
      console.error("Failed to create workflow:", err);
    }
  };

  const handleExecuteWorkflow = async (wf) => {
    setIsExecuting(wf.id);
    try {
      let compiledPrompt = `Execute the following software engineering workflow:\n\n`;
      if (wf.description) compiledPrompt += `Overall Goal: ${wf.description}\n\n`;

      if (wf.steps && wf.steps.length > 0) {
        compiledPrompt += "Steps to follow:\n";
        wf.steps.forEach((step, idx) => {
          compiledPrompt += `${idx + 1}. [${step.agent.toUpperCase()}]: ${step.description}\n`;
        });
      } else {
        compiledPrompt += wf.name;
      }
      await agentAPI.execute('full_stack', compiledPrompt);
    } catch (err) {
      console.error("Failed to execute workflow:", err);
    } finally {
      setTimeout(() => setIsExecuting(null), 3000);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'running': return <Badge variant="info" className="animate-pulse"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Running</Badge>;
      case 'completed': return <Badge variant="success">Completed</Badge>;
      case 'failed': return <Badge variant="destructive">Failed</Badge>;
      default: return <Badge variant="outline">Ready</Badge>;
    }
  };

  const getAgentIcon = (agentId) => {
    const agent = agentOptions.find(a => a.id === agentId);
    if (!agent) return <Bot className="h-3.5 w-3.5" />;
    const IconComp = agent.icon;
    return <IconComp className={`h-3.5 w-3.5 text-ai-${agent.color}`} />;
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Workflow Builder</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Design, save, and execute multi-agent pipelines</p>
        </div>
        <Button variant="ai" onClick={() => setShowForm(!showForm)} className="shrink-0">
          {showForm ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          {showForm ? 'Cancel' : 'New Workflow'}
        </Button>
      </div>

      {/* Create Workflow Form - Responsive */}
      {showForm && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
          <Card className="border-ai-blue/30 bg-[#0d1117]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Workflow className="h-4 w-4 text-ai-blue" /> Create Custom Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                <Input
                  value={newWorkflow.name}
                  onChange={(e) => setNewWorkflow(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Workflow Name (e.g., API Feature Builder)"
                  className="bg-background"
                />
                <Input
                  value={newWorkflow.description}
                  onChange={(e) => setNewWorkflow(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Overall Goal (e.g., Build a secure auth API)"
                  className="bg-background"
                />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-400">Pipeline Steps</h3>
                  <Button variant="ghost" size="sm" onClick={handleAddStep} className="text-ai-blue hover:text-ai-blue/80">
                    <Plus className="h-3 w-3 mr-1" /> Add Step
                  </Button>
                </div>
                {newWorkflow.steps.map((step, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <span className="text-xs text-muted-foreground font-mono w-6 shrink-0 pt-2 sm:pt-0">{idx + 1}.</span>
                    <select
                      value={step.agent}
                      onChange={(e) => handleStepChange(idx, 'agent', e.target.value)}
                      className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm w-full sm:w-auto"
                    >
                      {agentOptions.map(opt => (
                        <option key={opt.id} value={opt.id}>{opt.name}</option>
                      ))}
                    </select>
                    <Input
                      value={step.description}
                      onChange={(e) => handleStepChange(idx, 'description', e.target.value)}
                      placeholder="Step instruction..."
                      className="flex-1 bg-background"
                    />
                    {newWorkflow.steps.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-ai-red shrink-0" onClick={() => handleRemoveStep(idx)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button variant="ai" onClick={handleCreateWorkflow} disabled={!newWorkflow.name.trim()}>
                <Save className="h-4 w-4 mr-2" /> Save Workflow
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Workflows List - Responsive Grid */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-ai-blue" />
        </div>
      ) : workflows.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-20 text-center">
          <Workflow className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Workflows Yet</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Create a workflow to define custom sequences for the AI Engineer agents.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {workflows.map((wf) => (
            <Card key={wf.id} className="hover:border-ai-blue/30 transition-all flex flex-col h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Workflow className="h-4 w-4 text-ai-purple" /> {wf.name}
                  </CardTitle>
                  {getStatusBadge(wf.status)}
                </div>
                {wf.description && (
                  <CardDescription className="text-xs mt-1">{wf.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between space-y-4">
                {wf.steps && wf.steps.length > 0 ? (
                  <div className="space-y-2 bg-black/20 rounded-md p-2">
                    {wf.steps.map((step, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono text-gray-500">{idx + 1}.</span>
                        {getAgentIcon(step.agent)}
                        <span className="truncate">{step.description || step.agent}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground text-center py-4">No steps defined (Default pipeline will run)</div>
                )}
                <Button
                  variant="ai"
                  className="w-full"
                  onClick={() => handleExecuteWorkflow(wf)}
                  disabled={isExecuting === wf.id}
                >
                  {isExecuting === wf.id ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Dispatching...</>
                  ) : (
                    <><Play className="h-4 w-4 mr-2" /> Execute Pipeline</>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}