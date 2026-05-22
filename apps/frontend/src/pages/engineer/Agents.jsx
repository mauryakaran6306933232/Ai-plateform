import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/stores/appStore';
import {
 Bot, Brain, Shield, Sparkles, Loader2, CheckCircle, Pause,
 Play, Activity, Cpu, Zap, TestTube, Eye
} from 'lucide-react';

// All 6 agents in the pipeline
const agentData = [
 {
   id: 'planner',
   name: 'Planner Agent',
   icon: Brain,
   color: 'blue',
   type: 'Orchestrator',
   description: 'Breaks down complex user requests into structured, actionable sub-tasks and assigns them to the correct agent.',
   capabilities: ['Task Decomposition', 'Dependency Mapping', 'Priority Assignment', 'Mermaid Diagrams'],
 },
 {
   id: 'coder',
   name: 'Coder Agent',
   icon: Bot,
   color: 'purple',
   type: 'Generator',
   description: 'Generates production-quality code based on the Planner\'s tasks. Integrates RAG context from uploaded codebases.',
   capabilities: ['Multi-File Scaffolding', 'Context-Aware Editing', 'Self-Healing Auto-Fix', 'JSON Output'],
 },
 {
   id: 'security',
   name: 'Security Agent',
   icon: Shield,
   color: 'red',
   type: 'Auditor',
   description: 'Performs rigorous regex security scans for hardcoded secrets and runs pip audit inside Docker to check dependencies for CVEs.',
   capabilities: ['Secret Scanning', 'CVE Dependency Audit', 'Anti-Pattern Detection', 'Docker Isolation'],
 },
 {
   id: 'tester',
   name: 'Tester Agent',
   icon: TestTube,
   color: 'yellow',
   type: 'QA Engineer',
   description: 'Generates comprehensive pytest test suites for the Coder\'s output and executes them in an isolated Docker sandbox.',
   capabilities: ['Pytest Generation', 'Automated Execution', 'Edge Case Coverage', 'Docker Sandbox'],
 },
 {
   id: 'reviewer',
   name: 'Review Agent',
   icon: Eye,
   color: 'orange',
   type: 'Reviewer',
   description: 'Performs rigorous code reviews focusing on security vulnerabilities, performance bottlenecks, and best practices.',
   capabilities: ['Security Auditing', 'Performance Profiling', 'Bug Detection', 'Code Quality Review'],
 },
 {
   id: 'refactor',
   name: 'Refactor Agent',
   icon: Sparkles,
   color: 'green',
   type: 'Optimizer',
   description: 'Takes reviewed code and optimizes it for production. Focuses on clean architecture, DRY principles, and design patterns.',
   capabilities: ['Architecture Optimization', 'Design Patterns', 'Code Simplification', 'Production Readiness'],
 },
];

const containerVariants = {
 hidden: { opacity: 0 },
 show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
 hidden: { opacity: 0, y: 20 },
 show: { opacity: 1, y: 0 },
};

export default function Agents() {
 const navigate = useNavigate();
 const { activeModel, agentStates } = useAppStore(); // FIX: Read from global store

 const getStatusBadge = (status) => {
   switch (status) {
     case 'thinking':
       return <Badge variant="info" className="animate-pulse py-1"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Thinking</Badge>;
     case 'completed':
       return <Badge variant="success" className="py-1"><CheckCircle className="h-3 w-3 mr-1" /> Completed</Badge>;
     case 'idle':
     default:
       return <Badge variant="secondary" className="py-1"><Pause className="h-3 w-3 mr-1" /> Idle</Badge>;
   }
 };

 return (
   <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6 p-2 md:p-0">
     <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
       <div>
         <h1 className="text-2xl md:text-3xl font-bold">AI Agents & Swarms</h1>
         <p className="text-sm md:text-base text-muted-foreground mt-1">Monitor and manage your autonomous LangGraph workforce</p>
       </div>
       <div className="flex gap-3 items-center w-full sm:w-auto">
         <Badge variant="outline" className="py-1 px-3 border-ai-blue/30 shrink-0">
           <Cpu className="h-3 w-3 mr-2 text-ai-blue" /> Model: {activeModel || 'llama3'}
         </Badge>
         <Button variant="ai" size="sm" onClick={() => navigate('/engineer')} className="shrink-0">
           <Play className="h-4 w-4 mr-2" /> Execute Task
         </Button>
       </div>
     </div>

     {/* Workflow Architecture Visualization - Responsive */}
     <Card className="border-ai-blue/20 bg-[#0d1117] overflow-x-auto">
       <CardContent className="pt-6 pb-4 min-w-[600px]">
         <div className="flex items-center justify-between text-sm">
           {agentData.map((agent, idx) => (
             <React.Fragment key={agent.id}>
               <div className="flex flex-col items-center gap-1 w-1/6">
                 <div className={`h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all ${
                   agentStates[agent.id] === 'thinking' ? `border-ai-${agent.color} bg-ai-${agent.color}/10 animate-pulse` : 'border-gray-700 bg-gray-900'
                 }`}>
                   <agent.icon className={`h-5 w-5 text-ai-${agent.color}`} />
                 </div>
                 <span className={`text-xs font-medium text-ai-${agent.color} truncate w-full text-center`}>{agent.name.split(' ')[0]}</span>
               </div>
               {idx < agentData.length - 1 && (
                 <Zap className="h-4 w-4 text-gray-600 shrink-0" />
               )}
             </React.Fragment>
           ))}
         </div>
       </CardContent>
     </Card>

     {/* Agent Cards Grid - Responsive */}
     <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
       {agentData.map((agent) => (
         <motion.div key={agent.id} variants={itemVariants}>
           <Card className="hover:border-ai-blue/30 transition-all h-full flex flex-col">
             <CardHeader>
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                   <div className={`rounded-lg p-2.5 bg-ai-${agent.color}/10`}>
                     <agent.icon className={`h-6 w-6 text-ai-${agent.color}`} />
                   </div>
                   <div>
                     <CardTitle className="text-lg">{agent.name}</CardTitle>
                     <CardDescription className="text-xs">{agent.type} Agent</CardDescription>
                   </div>
                 </div>
                 {/* FIX: Now reads from global live state */}
                 {getStatusBadge(agentStates[agent.id])}
               </div>
             </CardHeader>
             <CardContent className="flex-1 flex flex-col justify-between space-y-4">
               <p className="text-sm text-muted-foreground">{agent.description}</p>

               <div className="space-y-3 mt-auto">
                 <div>
                   <h4 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Capabilities</h4>
                   <div className="flex flex-wrap gap-2">
                     {agent.capabilities.map(cap => (
                       <Badge key={cap} variant="outline" className="text-[10px] border-gray-700">
                         {cap}
                       </Badge>
                     ))}
                   </div>
                 </div>

                 <div className="flex items-center justify-between pt-2 border-t border-border">
                   <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                     <Activity className="h-3 w-3" />
                     <span>Powered by: <span className="text-ai-cyan font-mono">{activeModel || 'Ollama'}</span></span>
                   </div>
                   <Badge variant="secondary" className="text-[9px]">LangGraph Node</Badge>
                 </div>
               </div>
             </CardContent>
           </Card>
         </motion.div>
       ))}
     </div>
   </motion.div>
 );
}