import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { analyticsAPI, monitoringAPI } from '@/lib/api';
import socketManager from '@/lib/socket';
import { useAppStore } from '@/stores/appStore';
import { useNavigate } from 'react-router-dom';
import { Video, Mic, FileText, Radio, Square, Activity, Cpu, Eye, Terminal, Loader2 } from 'lucide-react';

export default function Streams() {
  const { systemHealth } = useAppStore();
  const navigate = useNavigate();
  
  const [systemStreamActive, setSystemStreamActive] = useState(systemHealth.cpu > 0);
  const [analyticsStreamActive, setAnalyticsStreamActive] = useState(false);
  const [logs, setLogs] = useState([]);
  const [isToggling, setIsToggling] = useState({ system: false, analytics: false });

  useEffect(() => {
    // Infer system stream status from live data
    if (systemHealth.cpu > 0) setSystemStreamActive(true);
  }, [systemHealth]);

  useEffect(() => {
    // Listen for analytics data to confirm stream is active
    const handleAnalyticsData = () => {
      setAnalyticsStreamActive(true);
    };
    
    socketManager.on('analytics:data', handleAnalyticsData);
    return () => socketManager.off('analytics:data', handleAnalyticsData);
  }, []);

  const addLog = (source, message) => {
    setLogs(prev => [
      { id: Date.now(), time: new Date().toLocaleTimeString(), source, message },
      ...prev
    ].slice(0, 30));
  };

  const toggleSystemStream = async () => {
    setIsToggling(prev => ({ ...prev, system: true }));
    try {
      if (systemStreamActive) {
        await monitoringAPI.stopMetricsStream();
        setSystemStreamActive(false);
        addLog('System', 'System metrics stream stopped.');
      } else {
        await monitoringAPI.startMetricsStream();
        setSystemStreamActive(true);
        addLog('System', 'System metrics stream started.');
      }
    } catch (err) {
      console.error("Stream Toggle Error:", err);
      const errorMsg = err.response?.data?.detail || err.message || "Unknown error";
      addLog('Error', `Failed to toggle system stream: ${errorMsg}`);
    } finally {
      setIsToggling(prev => ({ ...prev, system: false }));
    }
  };

  const toggleAnalyticsStream = async () => {
    setIsToggling(prev => ({ ...prev, analytics: true }));
    try {
      if (analyticsStreamActive) {
        await analyticsAPI.stopStream();
        setAnalyticsStreamActive(false);
        addLog('Analytics', 'Multimodal analytics stream stopped.');
      } else {
        await analyticsAPI.startStream();
        setAnalyticsStreamActive(true);
        addLog('Analytics', 'Multimodal analytics stream started.');
      }
    } catch (err) {
      addLog('Error', 'Failed to toggle analytics stream.');
    } finally {
      setIsToggling(prev => ({ ...prev, analytics: false }));
    }
  };

  const pipelines = [
    {
      id: 'system',
      name: 'System Metrics Pipeline',
      icon: Cpu,
      type: 'psutil + WebSocket',
      color: 'blue',
      isActive: systemStreamActive,
      isToggling: isToggling.system,
      toggle: toggleSystemStream,
      stats: (
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>CPU: <span className="text-ai-blue font-mono">{systemHealth.cpu}%</span></span>
          <span>RAM: <span className="text-ai-purple font-mono">{systemHealth.memory}%</span></span>
          <span>Disk: <span className="text-ai-green font-mono">{systemHealth.disk}%</span></span>
        </div>
      ),
      description: 'Real-time hardware telemetry streaming from the backend host machine.'
    },
    {
      id: 'analytics',
      name: 'Multimodal Analytics Pipeline',
      icon: Activity,
      type: 'Vision + Audio + NLP',
      color: 'purple',
      isActive: analyticsStreamActive,
      isToggling: isToggling.analytics,
      toggle: toggleAnalyticsStream,
      stats: (
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>Simulated Inference Engine</span>
        </div>
      ),
      description: 'Processes video object detection, audio transcriptions, and NLP pipelines.'
    },
    {
      id: 'vision',
      name: 'Live Vision Pipeline (TF.js)',
      icon: Eye,
      type: 'COCO-SSD + WebGL',
      color: 'cyan',
      isActive: false, // Managed on its own page
      isToggling: false,
      toggle: () => navigate('/analytics/vision'),
      stats: (
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>Requires Camera Access</span>
        </div>
      ),
      description: 'In-browser real-time object detection using TensorFlow.js and your webcam.'
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Stream Management</h1>
        <p className="text-muted-foreground mt-1">Control and monitor real-time data sources and AI pipelines</p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-3">
        {pipelines.map((stream) => {
          const isActive = stream.isActive;
          return (
            <Card key={stream.id} className={`flex flex-col transition-all ${isActive ? `border-ai-${stream.color}/30 bg-ai-${stream.color}/5` : ''}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className={`rounded-lg p-2 bg-ai-${stream.color}/10`}>
                    <stream.icon className={`h-5 w-5 text-ai-${stream.color}`} />
                  </div>
                  <Badge variant={isActive ? 'success' : 'secondary'} className="animate-pulse">
                    {isActive ? 'LIVE' : 'OFFLINE'}
                  </Badge>
                </div>
                <CardTitle className="text-base mt-3">{stream.name}</CardTitle>
                <CardDescription className="text-xs">{stream.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between mt-auto space-y-4">
                <div>
                  <Badge variant="outline" className="text-[10px] mb-2">{stream.type}</Badge>
                  <div className="mt-2">{stream.stats}</div>
                </div>
                
                <Button 
                  variant={stream.id === 'vision' ? 'outline' : (isActive ? 'destructive' : 'outline')} 
                  className="w-full"
                  onClick={stream.toggle}
                  disabled={stream.isToggling}
                >
                  {stream.isToggling ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Toggling...</>
                  ) : stream.id === 'vision' ? (
                    <><Eye className="h-4 w-4 mr-2" /> Open Vision Page</>
                  ) : isActive ? (
                    <><Square className="h-4 w-4 mr-2" /> Stop Stream</>
                  ) : (
                    <><Radio className="h-4 w-4 mr-2" /> Start Stream</>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pipeline Activity Log */}
      <Card className="bg-[#0d1117] border-gray-800">
        <CardHeader className="flex flex-row items-center justify-between border-b border-gray-800 pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-gray-300">
            <Terminal className="h-4 w-4 text-ai-green" /> Pipeline Activity Log
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setLogs([])} className="text-gray-500 hover:text-gray-300 text-xs">
            Clear
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[250px] w-full">
            <div className="p-4 font-mono text-xs space-y-2">
              {logs.length === 0 ? (
                <div className="text-gray-600 text-center py-10">
                  Toggle a stream to see activity logs...
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="flex gap-3 items-start text-gray-400">
                    <span className="text-gray-600 shrink-0 w-16">{log.time}</span>
                    <Badge variant="outline" className="h-5 text-[9px] shrink-0 justify-center w-20">{log.source}</Badge>
                    <span>{log.message}</span>
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