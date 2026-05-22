import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import socketManager from '@/lib/socket';

export default function AgentConsole() {
  const [logs, setLogs] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const scrollRef = useRef(null);

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    const handleStatus = (data) => {
      setLogs(prev => [...prev, { type: 'status', ...data }]);
      if (data.status === 'thinking') setIsRunning(true);
      if (data.status === 'completed' && data.agent_id === 'reviewer') setIsRunning(false);
    };

    const handleOutput = (data) => {
      setLogs(prev => {
        const lastLog = prev[prev.length - 1];
        // Append tokens to the last output log if it's the same agent
        if (lastLog && lastLog.agent_id === data.agent_id && lastLog.type === 'output') {
          const updated = [...prev];
          updated[updated.length - 1] = { ...lastLog, tokens: lastLog.tokens + data.token };
          return updated;
        }
        return [...prev, { type: 'output', agent_id: data.agent_id, tokens: data.token }];
      });
    };

    const handleWorkflow = (data) => {
      if (data.status === 'running') setIsRunning(true);
      if (data.status === 'completed') setIsRunning(false);
    };

    socketManager.on('agent:status', handleStatus);
    socketManager.on('agent:output', handleOutput);
    socketManager.on('workflow:status', handleWorkflow);

    return () => {
      socketManager.off('agent:status', handleStatus);
      socketManager.off('agent:output', handleOutput);
      socketManager.off('workflow:status', handleWorkflow);
    };
  }, []);

  const clearLogs = () => setLogs([]);

  return (
    <Card className="border-ai-blue/20 bg-[#0d1117] text-gray-200 font-mono text-sm">
      <CardHeader className="flex flex-row items-center justify-between border-b border-gray-800 pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-gray-300">
          Agent Console
          {isRunning && (
            <Badge variant="info" className="animate-pulse">● LIVE</Badge>
          )}
        </CardTitle>
        <button onClick={clearLogs} className="text-xs text-gray-500 hover:text-gray-300">Clear</button>
      </CardHeader>
      <CardContent className="p-0">
        <div ref={scrollRef} className="h-[400px] w-full overflow-y-auto p-4 pr-4">
          {logs.length === 0 ? (
            <div className="text-gray-600 text-center mt-20">
              Execute an agent task to see the live stream here...
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log, idx) => (
                <div key={idx}>
                  {log.type === 'status' && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-500">[SYS]</span>
                      <span className={log.status === 'thinking' ? 'text-ai-purple' : 'text-ai-green'}>
                        {log.message}
                      </span>
                    </div>
                  )}
                  {log.type === 'output' && (
                    <pre className="whitespace-pre-wrap text-ai-cyan bg-black/30 p-2 rounded border border-gray-800 overflow-x-auto">
                      {log.tokens}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}