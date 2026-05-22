import React from 'react';
import { Check, Loader2, Circle, Shield, TestTube } from 'lucide-react'; // Added Shield and TestTube

// FIX: Updated to the full 6-step Secure & Tested Pipeline
const steps = [
  { id: 'planner', label: 'Planner' },
  { id: 'coder', label: 'Coder' },
  { id: 'security', label: 'Security' },
  { id: 'tester', label: 'Tester' },
  { id: 'reviewer', label: 'Reviewer' },
  { id: 'refactor', label: 'Refactor' },
];

export default function WorkflowVisualizer({ agentStates }) {
  const getStatus = (id) => agentStates[id] || 'pending';
  
  return (
    <div className="flex items-center justify-between w-full bg-muted/50 p-4 rounded-xl border overflow-x-auto">
      {steps.map((step, idx) => {
        const status = getStatus(step.id);
        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center gap-2 min-w-[70px]">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all ${
                status === 'thinking' ? 'border-ai-purple bg-ai-purple/10 animate-pulse' :
                status === 'completed' ? 'border-ai-green bg-ai-green/10' :
                'border-gray-700 bg-gray-900'
              }`}>
                {status === 'thinking' ? <Loader2 className="h-5 w-5 text-ai-purple animate-spin" /> :
                 status === 'completed' ? <Check className="h-5 w-5 text-ai-green" /> :
                 <Circle className="h-5 w-5 text-gray-600" />}
              </div>
              <span className={`text-xs font-medium text-center ${
                status === 'thinking' ? 'text-ai-purple' :
                status === 'completed' ? 'text-ai-green' :
                'text-gray-500'
              }`}>{step.label}</span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 rounded-full transition-all ${
                getStatus(steps[idx+1].id) !== 'pending' ? 'bg-ai-green' : 'bg-gray-800'
              }`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}