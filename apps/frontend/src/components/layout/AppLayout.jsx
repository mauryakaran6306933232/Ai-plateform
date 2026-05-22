import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import CommandPalette from '@/components/shared/CommandPalette';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { authAPI } from '@/lib/api';

export default function AppLayout() {
  const { sidebarOpen } = useAppStore();
  const { user, token, setAuth, logout } = useAuthStore();

  useEffect(() => {
    const fetchUser = async () => {
      if (token && !user) {
        try {
          const res = await authAPI.me();
          setAuth(res.data, token);
        } catch (err) {
          // FIX: Only logout if the server explicitly says 401 Unauthorized.
          // If the server is down/timing out, we keep the user logged in using their local token.
          if (err.response && err.response.status === 401) {
            console.error("Token invalid or expired, logging out.");
            logout();
          } else {
            console.warn("Could not fetch user profile (Backend might be offline). Using cached auth.");
            // Keep them logged in with local token until backend comes back
          }
        }
      }
    };
    fetchUser();
  }, [token, user, setAuth, logout]);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div
        className="transition-all duration-200"
        style={{ marginLeft: sidebarOpen ? 260 : 72 }}
      >
        <Navbar />
        <main className="p-6">
          <Outlet />
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}