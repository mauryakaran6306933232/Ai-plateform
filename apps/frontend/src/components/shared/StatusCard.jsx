import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp } from 'lucide-react';

export default function StatusCard({ icon: Icon, title, value, suffix="", color, active, change }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className={`rounded-lg p-2 bg-ai-${color}/10`}>
            <Icon className={`h-4 w-4 text-ai-${color}`} />
          </div>
          <div className="flex items-center gap-2">
            {change && (
              <span className="flex items-center text-xs text-ai-green">
                <TrendingUp className="h-3 w-3 mr-1" />
                {change}
              </span>
            )}
            {active !== undefined && (
              <Badge variant={active ? 'success' : 'secondary'} className="text-[10px]">
                {active ? 'LIVE' : 'OFF'}
              </Badge>
            )}
          </div>
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold font-mono">
            {value}
            {suffix && <span className="text-sm text-muted-foreground ml-1">{suffix}</span>}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}