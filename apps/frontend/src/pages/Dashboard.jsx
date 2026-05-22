import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import StatusCard from '@/components/shared/StatusCard';
import ResourceBar from '@/components/shared/ResourceBar';
import { useAppStore } from '@/stores/appStore';
import { monitoringAPI } from '@/lib/api';
import {
 Bot, Brain, BarChart3, Activity, Cpu, HardDrive,
 Zap, ArrowUpRight, Clock, MessageSquare, GitBranch, Eye, AlertTriangle, Loader2
} from 'lucide-react';

const containerVariants = {
 hidden: { opacity: 0 },
 show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
 hidden: { opacity: 0, y: 20 },
 show: { opacity: 1, y: 0 },
};

export default function Dashboard() {
 const { systemHealth, tokenUsage, setTokenUsage, notifications } = useAppStore();
 const navigate = useNavigate();

 // Fetch Real Token Usage from Backend
 useEffect(() => {
   const fetchTokens = async () => {
     try {
       const res = await monitoringAPI.tokens();
       if (res.data) {
         // FIX: Map backend keys (total_tokens) to frontend keys (total)
         setTokenUsage({
           input: res.data.input_tokens || 0,
           output: res.data.output_tokens || 0,
           total: res.data.total_tokens || 0,
         });
       }
     } catch (err) {
       console.error("Failed to fetch token usage:", err);
     }
   };
   fetchTokens();
   const interval = setInterval(fetchTokens, 10000);
   return () => clearInterval(interval);
 }, [setTokenUsage]);

 const formatUptime = (seconds) => {
   if (!seconds) return '0m';
   const hrs = Math.floor(seconds / 3600);
   const mins = Math.floor((seconds % 3600) / 60);
   return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
 };

 // Map real notifications to Recent Activity feed
 const recentActivity = notifications.slice(0, 5).map(notif => ({
   time: formatTimeAgo(notif.timestamp),
   event: notif.message || notif.title || "System event",
   type: mapSeverityToType(notif.type || notif.severity)
 }));

 return (
   <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6 p-2 md:p-6">
     {/* Header */}
     <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
       <div>
         <h1 className="text-2xl md:text-3xl font-bold tracking-tight">AI Platform</h1>
         <p className="text-sm md:text-base text-muted-foreground mt-1">
           Multi-Agent Systems • AI OS • Multimodal Analytics
         </p>
       </div>
       <div className="flex gap-2">
         <Badge variant="info" className="animate-pulse-glow text-xs">● Operational</Badge>
         <Badge variant="outline" className="font-mono text-xs hidden sm:inline-flex">Uptime: {formatUptime(systemHealth.uptime_seconds)}</Badge>
       </div>
     </motion.div>

     {/* Live Stats Grid - Responsive */}
     <motion.div variants={itemVariants} className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
       <StatusCard
         title="CPU Usage"
         value={systemHealth.cpu}
         suffix="%"
         icon={Cpu}
         color="blue"
         active={systemHealth.cpu > 0}
       />
       <StatusCard
         title="Memory Usage"
         value={`${systemHealth.memory_used_gb || 0}/${systemHealth.memory_total_gb || 0}`}
         suffix=" GB"
         icon={HardDrive}
         color="purple"
         active={systemHealth.memory > 0}
       />
       <StatusCard
         title="GPU Compute"
         value={systemHealth.gpu}
         suffix="%"
         icon={Activity}
         color="cyan"
         active={systemHealth.gpu > 0}
       />
       <StatusCard
         title="Tokens Processed"
         value={(tokenUsage?.total || 0).toLocaleString()} // FIX: Safe accessor
         icon={Zap}
         color="green"
       />
     </motion.div>

     {/* Project Cards - Responsive */}
     <motion.div variants={itemVariants} className="grid gap-6 grid-cols-1 md:grid-cols-3">
       <ProjectCard
         title="AI Engineer"
         description="Autonomous multi-agent software engineer that writes, tests, reviews, and deploys code."
         icon={Bot} color="blue"
         stats={{ agents: 6, tasks: 142, success: '94%' }}
         path="/engineer" badge="Project 1"
         navigate={navigate}
       />
       <ProjectCard
         title="AI OS (Jarvis)"
         description="Personal AI operating system with voice, memory, automation, and autonomous planning."
         icon={Brain} color="purple"
         stats={{ commands: 891, memory: '2.4GB', uptime: '99.7%' }}
         path="/jarvis" badge="Project 2"
         navigate={navigate}
       />
       <ProjectCard
         title="Multimodal Analytics"
         description="Real-time AI analytics platform for video, audio, text, and streaming analysis."
         icon={BarChart3} color="cyan"
         stats={{ streams: 8, models: 5, fps: '30' }}
         path="/analytics" badge="Project 3"
         navigate={navigate}
       />
     </motion.div>

     {/* System Resources & Tokens - Responsive */}
     <motion.div variants={itemVariants} className="grid gap-4 grid-cols-1 md:grid-cols-2">
       <Card>
         <CardHeader>
           <CardTitle className="flex items-center gap-2 text-base">
             <Cpu className="h-4 w-4 text-ai-blue" />
             Live System Resources
           </CardTitle>
         </CardHeader>
         <CardContent className="space-y-4">
           <ResourceBar label="CPU Usage" value={systemHealth.cpu} color="blue" />
           <ResourceBar label="Memory" value={systemHealth.memory} color="purple" displayValue={`${systemHealth.memory_used_gb || 0}/${systemHealth.memory_total_gb || 0} GB`} />
           <ResourceBar label="Disk" value={systemHealth.disk} color="green" />
           <ResourceBar label="GPU" value={systemHealth.gpu} color="cyan" displayValue={systemHealth.gpu_vram_total_gb ? `${systemHealth.gpu_vram_used_gb || 0}/${systemHealth.gpu_vram_total_gb} GB` : 'N/A'} />
         </CardContent>
       </Card>
       <Card>
         <CardHeader>
           <CardTitle className="flex items-center gap-2 text-base">
             <Activity className="h-4 w-4 text-ai-green" />
             Real Token Usage
           </CardTitle>
         </CardHeader>
         <CardContent>
           <div className="space-y-3">
             <div className="flex justify-between text-sm">
               <span className="text-muted-foreground">Input Tokens</span>
               <span className="font-mono">{(tokenUsage?.input || 0).toLocaleString()}</span>
             </div>
             <div className="flex justify-between text-sm">
               <span className="text-muted-foreground">Output Tokens</span>
               <span className="font-mono">{(tokenUsage?.output || 0).toLocaleString()}</span>
             </div>
             <div className="h-px bg-border" />
             <div className="flex justify-between text-sm font-medium">
               <span>Total</span>
               <span className="font-mono text-ai-blue">{(tokenUsage?.total || 0).toLocaleString()}</span>
             </div>
             <div className="mt-4 flex gap-2">
               <Badge variant="info">Ollama Local</Badge>
               <Badge variant="success">Cost: $0.00</Badge>
             </div>
           </div>
         </CardContent>
       </Card>
     </motion.div>

     {/* Real Recent Activity */}
     <motion.div variants={itemVariants}>
       <Card>
         <CardHeader><CardTitle className="text-base">Recent Activity</CardTitle></CardHeader>
         <CardContent>
           <div className="space-y-3">
             {recentActivity.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                 <Activity className="h-8 w-8 mb-2" />
                 <p className="text-sm">Waiting for system events...</p>
               </div>
             ) : (
               recentActivity.map((item, i) => (
                 <div key={i} className="flex items-center gap-3 text-sm">
                   <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                   <span className="text-muted-foreground w-16 shrink-0 text-xs">{item.time}</span>
                   <Badge
                     variant={
                       item.type === 'success' ? 'success' :
                       item.type === 'warning' ? 'warning' :
                       item.type === 'error' ? 'destructive' : 'info'
                     }
                     className="shrink-0 text-[10px]"
                   >
                     {item.type}
                   </Badge>
                   <span className="truncate text-xs md:text-sm">{item.event}</span>
                 </div>
               ))
             )}
           </div>
         </CardContent>
       </Card>
     </motion.div>
   </motion.div>
 );
}

// Helper Functions
function formatTimeAgo(timestamp) {
 if (!timestamp) return 'Just now';
 const date = new Date(timestamp);
 const now = new Date();
 const diffMs = now - date;
 const diffMins = Math.floor(diffMs / 60000);
 
 if (diffMins === 0) return 'Just now';
 if (diffMins < 60) return `${diffMins}m ago`;
 const diffHours = Math.floor(diffMins / 60);
 return `${diffHours}h ago`;
}

function mapSeverityToType(severity) {
 if (severity === 'critical') return 'error';
 if (severity === 'warning') return 'warning';
 if (severity === 'success') return 'success';
 return 'info';
}

// Project Card Component
function ProjectCard({ title, description, icon: Icon, color, stats, path, badge, navigate }) {
 return (
   <Card 
     className="group hover:border-ai-blue/50 transition-all cursor-pointer h-full flex flex-col"
     onClick={() => navigate(path)}
   >
     <CardHeader>
       <div className="flex items-center justify-between">
         <div className={`rounded-lg p-2.5 bg-ai-${color}/10`}>
           <Icon className={`h-5 w-5 text-ai-${color}`} />
         </div>
         <Badge variant="purple" className="text-[9px]">{badge}</Badge>
       </div>
       <CardTitle className="text-lg mt-3">{title}</CardTitle>
       <CardDescription className="text-xs">{description}</CardDescription>
     </CardHeader>
     <CardContent className="mt-auto">
       <div className="flex justify-between text-xs text-muted-foreground">
         {Object.entries(stats).map(([key, val]) => (
           <div key={key} className="text-center">
             <p className="font-mono font-medium text-foreground">{val}</p>
             <p className="capitalize">{key}</p>
           </div>
         ))}
       </div>
       <Button variant="ghost" className="w-full mt-4 group-hover:bg-ai-blue/10 text-xs pointer-events-none">
         Open <ArrowUpRight className="h-3 w-3 ml-1" />
       </Button>
     </CardContent>
   </Card>
 );
}