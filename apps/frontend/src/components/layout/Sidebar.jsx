import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/appStore';
import { Bot, Brain, BarChart3, Home, Settings, GitBranch, Cpu, Eye, MessageSquare, Zap, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

const navItems = [
  { label: 'Dashboard', icon: Home, path: '/' },
  { label: 'AI Engineer', icon: Bot, path: '/engineer', badge: 'P1', children: [
    { label: 'Projects', icon: GitBranch, path: '/engineer/projects' },
    { label: 'Agents', icon: Cpu, path: '/engineer/agents' },
    { label: 'Workflows', icon: Zap, path: '/engineer/workflows' },
  ]},
  { label: 'AI OS', icon: Brain, path: '/jarvis', badge: 'P2', children: [
    { label: 'Chat', icon: MessageSquare, path: '/jarvis/chat' },
    { label: 'Automation', icon: Bot, path: '/jarvis/automation' },
    { label: 'Memory', icon: Sparkles, path: '/jarvis/memory' },
  ]},
  { label: 'Analytics', icon: BarChart3, path: '/analytics', badge: 'P3', children: [
    { label: 'Dashboard', icon: BarChart3, path: '/analytics/dashboard' },
    { label: 'Vision', icon: Eye, path: '/analytics/vision' },
    { label: 'Streams', icon: Zap, path: '/analytics/streams' },
  ]},
  { label: 'Settings', icon: Settings, path: '/settings' },
];

export default function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useAppStore();
  const location = useLocation();

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarOpen ? 260 : 72 }}
      transition={{ duration: 0.2 }}
      className="fixed left-0 top-0 z-40 flex h-screen flex-col border-r bg-sidebar text-sidebar-foreground"
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b px-4 shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-ai-blue to-ai-purple">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <span className="text-sm font-bold">AI Platform</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation - Replaced ScrollArea with a standard scrollable div */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path) && item.path !== '/';
            const isExact = item.path === '/' && location.pathname === '/';
            const active = isActive || isExact;
            const [expanded, setExpanded] = React.useState(active);

            return (
              <div key={item.path}>
                <NavLink 
                  to={item.path} 
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:bg-sidebar-accent', 
                    active && 'bg-sidebar-accent font-medium'
                  )} 
                  onClick={() => item.children && setExpanded(!expanded)}
                >
                  <item.icon className={cn('h-4 w-4 shrink-0', active && 'text-ai-blue')} />
                  {sidebarOpen && (
                    <>
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span className="text-[9px] rounded bg-ai-purple/20 px-1.5 py-0.5 text-ai-purple">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
                
                {sidebarOpen && item.children && expanded && (
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    className="ml-4 mt-1 space-y-1 border-l pl-3"
                  >
                    {item.children.map((child) => (
                      <NavLink 
                        key={child.path} 
                        to={child.path} 
                        className={({ isActive }) => cn(
                          'flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-sidebar-accent', 
                          isActive && 'bg-sidebar-accent text-ai-blue font-medium'
                        )}
                      >
                        <child.icon className="h-3.5 w-3.5" />
                        <span>{child.label}</span>
                      </NavLink>
                    ))}
                  </motion.div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Toggle Button */}
      <div className="border-t p-3 shrink-0">
        <button 
          onClick={toggleSidebar} 
          className="flex w-full items-center justify-center rounded-lg p-2 hover:bg-sidebar-accent transition-colors"
        >
          {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
    </motion.aside>
  );
}