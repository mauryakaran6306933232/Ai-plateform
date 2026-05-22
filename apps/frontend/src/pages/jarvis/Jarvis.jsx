import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, MessageSquare, Bot, Sparkles, Mic, Monitor } from 'lucide-react';

export default function Jarvis() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI OS — Jarvis</h1>
        <p className="text-muted-foreground mt-1">Personal autonomous AI operating system</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[
          { icon: Mic, title: 'Voice Interface', desc: 'Whisper-powered voice commands', color: 'purple' },
          { icon: Monitor, title: 'Browser Automation', desc: 'Playwright-powered web actions', color: 'blue' },
          { icon: Sparkles, title: 'Long-Term Memory', desc: 'ChromaDB persistent context', color: 'cyan' },
          { icon: Bot, title: 'Autonomous Planning', desc: 'LangGraph agent workflows', color: 'green' },
          { icon: MessageSquare, title: 'Multi-Agent Coordination', desc: 'CrewAI team orchestration', color: 'orange' },
          { icon: Brain, title: 'Real-Time Reasoning', desc: 'Ollama local inference', color: 'purple' },
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