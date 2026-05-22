import React from 'react';
import { motion } from 'framer-motion';

export default function ResourceBar({ label, value, max=100, color, displayValue }) {
  const percentage = (value / max) * 100;
  const display = displayValue || `${value}%`;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{display}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className={`h-full rounded-full bg-ai-${color} ${
            percentage > 80 ? 'animate-pulse' : ''
          }`}
        />
      </div>
    </div>
  );
}