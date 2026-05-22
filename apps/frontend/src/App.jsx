import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import socketManager from '@/lib/socket';
import ProtectedRoute from '@/components/auth/ProtectedRoute'; // 🚀 NEW

// Lazy load project pages
const Login = lazy(() => import('@/pages/Login'));
const AIEngineer = lazy(() => import('@/pages/engineer/AIEngineer'));
const EngineerProjects = lazy(() => import('@/pages/engineer/Projects'));
const EngineerAgents = lazy(() => import('@/pages/engineer/Agents'));
const EngineerWorkflows = lazy(() => import('@/pages/engineer/Workflows'));
const Jarvis = lazy(() => import('@/pages/jarvis/Jarvis'));
const JarvisChat = lazy(() => import('@/pages/jarvis/Chat'));
const JarvisAutomation = lazy(() => import('@/pages/jarvis/Automation'));
const JarvisMemory = lazy(() => import('@/pages/jarvis/Memory'));
const Analytics = lazy(() => import('@/pages/analytics/Analytics'));
const AnalyticsDashboard = lazy(() => import('@/pages/analytics/AnalyticsDashboard'));
const AnalyticsVision = lazy(() => import('@/pages/analytics/Vision'));
const AnalyticsStreams = lazy(() => import('@/pages/analytics/Streams'));
const Settings = lazy(() => import('@/pages/Settings'));

function LoadingFallback() {
  return (
    <div className="flex h-[50vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ai-blue border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

export default function App() {
  // ✅ CONNECT WEBSOCKET ON APP LOAD
  useEffect(() => {
    console.log("🔌 Connecting to WebSocket...");
    socketManager.connect();

    return () => {
      socketManager.disconnect();
    };
  }, []);

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        {/* Public Route */}
        <Route path="/login" element={<Login />} />
        
        {/* 🚀 NEW: Protected Routes wrapped in ProtectedRoute */}
        <Route 
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/engineer" element={<AIEngineer />} />
          <Route path="/engineer/projects" element={<EngineerProjects />} />
          <Route path="/engineer/agents" element={<EngineerAgents />} />
          <Route path="/engineer/workflows" element={<EngineerWorkflows />} />
          <Route path="/jarvis" element={<Jarvis />} />
          <Route path="/jarvis/chat" element={<JarvisChat />} />
          <Route path="/jarvis/automation" element={<JarvisAutomation />} />
          <Route path="/jarvis/memory" element={<JarvisMemory />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/analytics/dashboard" element={<AnalyticsDashboard />} />
          <Route path="/analytics/vision" element={<AnalyticsVision />} />
          <Route path="/analytics/streams" element={<AnalyticsStreams />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </Suspense>
  );
}