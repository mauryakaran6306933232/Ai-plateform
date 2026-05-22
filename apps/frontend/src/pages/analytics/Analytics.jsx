import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart3, Eye, Video, Mic, FileText, Zap } from 'lucide-react';

export default function Analytics() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Multimodal AI Analytics</h1>
        <p className="text-muted-foreground mt-1">Real-time video, audio, text, and streaming analysis</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[
          { icon: Video, title: 'Video Analysis', desc: 'YOLOv8 + OpenCV real-time detection', color: 'blue' },
          { icon: Eye, title: 'Emotion Detection', desc: 'Facial expression analysis', color: 'purple' },
          { icon: Mic, title: 'Audio Intelligence', desc: 'Whisper + NLP audio pipelines', color: 'cyan' },
          { icon: FileText, title: 'NLP Pipelines', desc: 'Transformer-based text analytics', color: 'green' },
          { icon: Zap, title: 'Streaming Analytics', desc: 'Redis + WebSocket real-time', color: 'orange' },
          { icon: BarChart3, title: 'Explainable AI', desc: 'Model interpretability dashboards', color: 'blue' },
        ].map((item) => (
          <Card key={item.title} className="hover:border-ai-blue/30 transition-all">
            <CardHeader>
              <div className={`rounded-lg p-2 w-fit bg-ai-${item.color}/10`}>
                <item.icon className={`h-5 w-5 text-ai-${item.color}`} />
              </div>
              <CardTitle className="text-base mt-2">{item.title}</CardTitle>
              <CardDescription className="text-xs">{item.desc}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}