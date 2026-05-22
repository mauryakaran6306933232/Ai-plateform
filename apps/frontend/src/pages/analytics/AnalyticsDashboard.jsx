import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import StatusCard from '@/components/shared/StatusCard';
import socketManager from '@/lib/socket';
import { analyticsAPI, monitoringAPI } from '@/lib/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import {
  Activity, Cpu, Eye, HardDrive, Mic, Zap, Radio, Square, CircuitBoard, Database, Clock, Upload, Loader2, Gauge
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';

export default function AnalyticsDashboard() {
  const { systemHealth } = useAppStore();
  const [isStreaming, setIsStreaming] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [cpuHistory, setCpuHistory] = useState([]);
  const [memHistory, setMemHistory] = useState([]);
  const [gpuHistory, setGpuHistory] = useState([]);
  const [diskHistory, setDiskHistory] = useState([]);
  const [fpsHistory, setFpsHistory] = useState([]);
  const [latencyHistory, setLatencyHistory] = useState([]);

  // NEW: Benchmark State
  const [benchmarkData, setBenchmarkData] = useState([]);
  const [latestData, setLatestData] = useState(null);

  // FIX: Ref to track user stop intent and prevent WS race condition
  const isStreamingRef = useRef(true); 

  useEffect(() => {
    const handleMetrics = (data) => {
      const timeLabel = new Date(data.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setCpuHistory(prev => [...prev.slice(-29), { t: timeLabel, v: data.cpu_percent }]);
      setMemHistory(prev => [...prev.slice(-29), { t: timeLabel, v: data.memory_percent }]);
      setDiskHistory(prev => [...prev.slice(-29), { t: timeLabel, v: data.disk_percent }]);
      if (data.gpu_percent > 0) {
        setGpuHistory(prev => [...prev.slice(-29), { t: timeLabel, v: data.gpu_percent }]);
      }
    };
    socketManager.on('system:metrics', handleMetrics);
    return () => socketManager.off('system:metrics', handleMetrics);
  }, []);

  useEffect(() => {
    const handleData = (data) => {
      // FIX: If user clicked stop, ignore incoming lingering WS messages
      if (!isStreamingRef.current) return;

      setIsStreaming(true);
      setLatestData(data);
      setFpsHistory(prev => [...prev.slice(-19), { t: data.timestamp, v: data.video.fps }]);
      setLatencyHistory(prev => [...prev.slice(-19), { t: data.timestamp, v: data.audio.latency_ms }]);
    };
    socketManager.on('analytics:data', handleData);
    
    // Auto-start on mount
    startStream();

    return () => socketManager.off('analytics:data', handleData);
  }, []);

  // NEW: Fetch Benchmark Data
  useEffect(() => {
    const fetchBenchmark = async () => {
      try {
        const res = await monitoringAPI.benchmark();
        if (res.data.recent) {
          const formatted = res.data.recent.map(r => ({
            model: r.model.split(':')[0], // Trim model tag
            tps: r.tokens_per_sec
          })).slice(-10); // Last 10 inferences
          setBenchmarkData(formatted);
        }
      } catch (err) { console.error("Failed to fetch benchmark", err); }
    };
    fetchBenchmark();
    const interval = setInterval(fetchBenchmark, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, []);

  const stopStream = async () => {
    isStreamingRef.current = false; // Mark as stopped
    await analyticsAPI.stopStream();
    setIsStreaming(false);
  };

  const startStream = async () => {
    isStreamingRef.current = true; // Mark as started
    await analyticsAPI.startStream();
    setIsStreaming(true);
  };

  const handleAudioUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsTranscribing(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      await analyticsAPI.transcribeAudio(formData);
      setTimeout(() => setIsTranscribing(false), 30000);
    } catch (err) {
      setIsTranscribing(false);
      alert("Upload failed. Is the backend running?");
    } finally {
      e.target.value = '';
    }
  };

  const RealTimeChart = ({ title, icon: Icon, color, data, dataKey, domain }) => (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className={`h-4 w-4 text-ai-${color}`} /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="t" stroke="#666" tick={{ fontSize: 10 }} interval={4} />
            <YAxis stroke="#666" domain={domain} tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e1e2e', border: '1px solid #333', borderRadius: '8px', color: '#fff' }}
              labelStyle={{ color: '#aaa' }}
            />
            <Line type="monotone" dataKey={dataKey} stroke={`var(--tw-ai-${color}, #3b82f6)`} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Real-Time Dashboard</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Live multimodal pipeline & system metrics</p>
        </div>
        <div className="flex gap-2">
          {isStreaming ? (
            <Button variant="destructive" size="sm" onClick={stopStream}>
              <Square className="h-4 w-4 mr-2" /> Stop Analytics
            </Button>
          ) : (
            <Button variant="ai" size="sm" onClick={startStream}>
              <Radio className="h-4 w-4 mr-2" /> Start Analytics
            </Button>
          )}
        </div>
      </div>

      {/* FIX: Responsive Status Grid */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 xl:grid-cols-5">
        <StatusCard icon={Cpu} title="CPU Usage" value={systemHealth.cpu} suffix="%" color="blue" active={systemHealth.cpu > 0} />
        <StatusCard icon={HardDrive} title="Memory" value={`${systemHealth.memory_used_gb || 0}/${systemHealth.memory_total_gb || 0}`} suffix=" GB" color="purple" active={systemHealth.memory > 0} />
        {systemHealth.gpu > 0 ? (
          <StatusCard icon={CircuitBoard} title="GPU Compute" value={systemHealth.gpu} suffix="%" color="cyan" active={systemHealth.gpu > 0} />
        ) : (
          <StatusCard icon={Database} title="Disk Usage" value={systemHealth.disk} suffix="%" color="green" active={systemHealth.disk > 0} />
        )}
        <StatusCard icon={Clock} title="Uptime" value={Math.floor((systemHealth.uptime_seconds || 0) / 60)} suffix=" min" color="orange" />
        <StatusCard icon={Eye} title="Vision FPS" value={latestData?.video?.fps?.toFixed(1) || '0'} suffix=" fps" color="blue" active={isStreaming} />
      </div>

      {/* FIX: Responsive Chart Grid */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        <RealTimeChart title="Real CPU Usage (%)" icon={Cpu} color="blue" data={cpuHistory} dataKey="v" domain={[0, 100]} />
        <RealTimeChart title="Real Memory Usage (%)" icon={HardDrive} color="purple" data={memHistory} dataKey="v" domain={[0, 100]} />
        {systemHealth.gpu > 0 ? (
          <RealTimeChart title="Real GPU Usage (%)" icon={CircuitBoard} color="cyan" data={gpuHistory} dataKey="v" domain={[0, 100]} />
        ) : (
          <RealTimeChart title="Disk Usage (%)" icon={Database} color="green" data={diskHistory} dataKey="v" domain={[0, 100]} />
        )}
        <RealTimeChart title="Vision Pipeline (FPS)" icon={Eye} color="blue" data={fpsHistory} dataKey="v" domain={[0, 60]} />
      </div>

      {/* NEW: LLM Performance Benchmarking */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Gauge className="h-4 w-4 text-ai-green" /> Local LLM Performance (Tokens/Sec)
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={benchmarkData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="model" stroke="#666" tick={{ fontSize: 10 }} />
              <YAxis stroke="#666" tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e1e2e', border: '1px solid #333', borderRadius: '8px', color: '#fff' }}
                labelStyle={{ color: '#aaa' }}
              />
              <Bar dataKey="tps" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* FIX: Responsive Live Stats Grid */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="h-4 w-4 text-ai-cyan" /> Live Vision Detections
            </CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-sm text-gray-300 bg-black/40 p-4 rounded-md h-[180px] flex items-center justify-center">
            {latestData?.video?.object_count > 0 ? (
              <div className="text-center">
                <Badge variant="info" className="mb-2">{latestData.video.object_count} Objects Detected</Badge>
                <p className="text-xs text-gray-400">{latestData.video.objects_detected.join(', ')}</p>
              </div>
            ) : (
              <span className="text-gray-600 text-xs">No objects in current frame</span>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Mic className="h-4 w-4 text-ai-green" /> Audio Transcriptions
            </CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-sm text-gray-300 bg-black/40 p-4 rounded-md h-[180px] flex items-center justify-center">
            {latestData?.audio?.transcription ? (
              <div className="animate-pulse text-center">"{latestData.audio.transcription}"</div>
            ) : (
              <span className="text-gray-600 text-xs">No active audio stream</span>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-ai-orange/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mic className="h-4 w-4 text-ai-orange" /> Audio Intelligence (Whisper Local)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Upload an audio file to transcribe it using local Whisper AI.
            The transcription runs in the background—Jarvis will notify you in the bell icon when it's done!
          </p>
          <div className="flex items-center gap-4">
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".mp3,.wav,.m4a,.flac"
                onChange={handleAudioUpload}
                disabled={isTranscribing}
                className="hidden"
              />
              <Button variant="outline" size="sm" disabled={isTranscribing} className="border-ai-orange/30 text-ai-orange hover:bg-ai-orange/10">
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Audio File
                </span>
              </Button>
            </label>
            {isTranscribing && (
              <Badge variant="warning" className="animate-pulse py-1">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Processing via Whisper...
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}