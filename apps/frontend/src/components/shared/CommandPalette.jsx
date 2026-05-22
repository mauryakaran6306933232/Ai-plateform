import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { jarvisAPI } from '@/lib/api';
import { useAppStore } from '@/stores/appStore'; // NEW
import {
  Search, Bot, Cpu, Trash2, Brain, GitBranch, Plus, Settings, Activity, Play
} from 'lucide-react';

const commands = [
  { id: 'nav_engineer', label: 'Go to AI Engineer', icon: Bot, path: '/engineer', color: 'blue' },
  { id: 'nav_jarvis', label: 'Go to Jarvis Chat', icon: Brain, path: '/jarvis/chat', color: 'purple' },
  { id: 'nav_analytics', label: 'Go to Analytics', icon: Activity, path: '/analytics/dashboard', color: 'cyan' },
  { id: 'nav_settings', label: 'Go to Settings', icon: Settings, path: '/settings', color: 'gray' },
  { id: 'act_status', label: 'Jarvis: Check System Status', icon: Cpu, action: 'Jarvis, check the system metrics', color: 'green' },
  { id: 'act_latest', label: 'Jarvis: Run Latest Script', icon: Play, action: 'Jarvis, run my latest code', color: 'green' },
  { id: 'act_search', label: 'Jarvis: Search AI News', icon: Search, action: 'Jarvis, search the web for latest AI news', color: 'purple' },
  { id: 'act_clear', label: 'System: Clear Jarvis Memory', icon: Trash2, action: 'CLEAR_MEMORY', color: 'red' },
];

export default function CommandPalette() {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { commandPaletteOpen, setCommandPaletteOpen } = useAppStore(); // NEW

  useEffect(() => {
    const down = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen); // NEW
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  const handleSelect = async (cmd) => {
    setCommandPaletteOpen(false); // NEW
    setSearch('');

    if (cmd.path) {
      navigate(cmd.path);
    } else if (cmd.action === 'CLEAR_MEMORY') {
      const { monitoringAPI } = await import('@/lib/api');
      await monitoringAPI.clearMemory();
      window.location.reload();
    } else if (cmd.action) {
      await jarvisAPI.chat(cmd.action, null, 'default');
    }
  };

  const filteredCommands = commands.filter(cmd => 
    cmd.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
      <DialogContent className="sm:max-w-[500px] p-0 bg-[#0d1117] border-gray-800 text-white shadow-2xl">
        <div className="flex items-center border-b border-gray-800 px-4 py-3">
          <Search className="h-5 w-5 text-gray-500 mr-2 shrink-0" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type a command or search..."
            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-gray-200 placeholder-gray-600 h-9 p-0"
            autoFocus
          />
          <kbd className="ml-2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-gray-700 bg-gray-800 px-1.5 font-mono text-[10px] font-medium text-gray-500">
            Esc
          </kbd>
        </div>
        <div className="max-h-[400px] overflow-y-auto py-2 px-2">
          {filteredCommands.length === 0 ? (
            <div className="text-center text-gray-600 text-sm py-10">No commands found.</div>
          ) : (
            filteredCommands.map(cmd => (
              <div
                key={cmd.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer hover:bg-gray-800 transition-colors text-gray-300 hover:text-white"
                onClick={() => handleSelect(cmd)}
              >
                <cmd.icon className={`h-4 w-4 text-ai-${cmd.color} shrink-0`} />
                <span className="text-sm">{cmd.label}</span>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}