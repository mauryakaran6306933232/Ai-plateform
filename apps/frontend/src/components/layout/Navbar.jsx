import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Bell, Search, Wifi, WifiOff, Cpu, HardDrive, Activity,
  Moon, Sun, LogOut, X, AlertTriangle, AlertCircle, Info, Menu
} from 'lucide-react';

export default function Navbar() {
  const { theme, setTheme, systemHealth, tokenUsage, notifications, toggleSidebar, toggleCommandPalette } = useAppStore();
  const { logout } = useAuthStore();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const isHealthy = systemHealth.status === 'healthy';

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const getAlertIcon = (type) => {
    if (type === 'critical' || type === 'error') return <AlertTriangle className="h-4 w-4 text-ai-red" />;
    if (type === 'warning') return <AlertCircle className="h-4 w-4 text-ai-orange" />;
    return <Info className="h-4 w-4 text-ai-blue" />;
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return 'Just now';
    const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
    if (diff === 0) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    return `${Math.floor(diff/60)}h ago`;
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 md:gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
      {/* Mobile Menu Toggle */}
      <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={toggleSidebar}>
        <Menu className="h-5 w-5" />
      </Button>

      {/* Search - Opens Command Palette */}
      <div 
        className="flex flex-1 items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm text-muted-foreground cursor-pointer hover:bg-muted transition-colors"
        onClick={toggleCommandPalette}
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Search agents, projects, commands...</span>
        <span className="sm:hidden">Search...</span>
        <kbd className="ml-auto hidden md:inline-flex rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">⌘K</kbd>
      </div>

      {/* System Status - Responsive */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Live CPU - Hidden on small screens */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground border-r pr-3">
          <Cpu className="h-3.5 w-3.5 text-ai-blue" />
          <span className="font-mono w-8">{systemHealth.cpu}%</span>
        </div>
        {/* Live Memory - Hidden on small screens */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground border-r pr-3">
          <HardDrive className="h-3.5 w-3.5 text-ai-purple" />
          <span className="font-mono w-8">{systemHealth.memory}%</span>
        </div>
        
        {/* Token Usage - FIX: Added safe accessor ?. */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
          <Activity className="h-3.5 w-3.5" />
          <span>{(tokenUsage?.total || 0).toLocaleString()} tokens</span>
        </div>

        {/* Connection Status */}
        <div className="flex items-center gap-1.5">
          {isHealthy ? (
            <Wifi className="h-3.5 w-3.5 text-ai-green" />
          ) : (
            <WifiOff className="h-3.5 w-3.5 text-ai-red" />
          )}
          <Badge variant={isHealthy ? 'success' : 'destructive'} className="text-[10px] hidden sm:inline-flex">
            {isHealthy ? 'Connected' : 'Disconnected'}
          </Badge>
        </div>

        {/* Notifications Bell with Dropdown */}
        <div className="relative">
          <button
            className="relative p-2 hover:bg-muted rounded-lg transition-colors"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <Bell className="h-4 w-4" />
            {notifications.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 h-4 w-4 rounded-full bg-ai-red text-[10px] font-bold text-white flex items-center justify-center">
                {notifications.length > 9 ? '9+' : notifications.length}
              </span>
            )}
          </button>

          {/* Notification Dropdown Panel */}
          {showNotifications && (
            <div className="absolute right-0 top-12 w-80 max-h-[400px] overflow-y-auto bg-popover border rounded-xl shadow-2xl z-50">
              <div className="flex items-center justify-between p-3 border-b">
                <h3 className="font-semibold text-sm">Notifications</h3>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No new notifications
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notif, idx) => (
                    <div key={notif.id || idx} className="flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors">
                      <div className="mt-0.5">
                        {getAlertIcon(notif.type || notif.severity)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {notif.title || "System Alert"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {notif.message}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-1">{formatTimeAgo(notif.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 hover:bg-muted rounded-lg transition-colors hidden md:inline-flex"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="p-2 hover:bg-red-500/10 text-muted-foreground hover:text-ai-red rounded-lg transition-colors"
          title="Logout"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}