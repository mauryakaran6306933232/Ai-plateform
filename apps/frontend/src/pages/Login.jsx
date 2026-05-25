import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authAPI } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Bot } from 'lucide-react';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('admin@ai-platform.com');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setAuth } = useAuthStore(); // Get the setAuth function

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isLogin) {
        const res = await authAPI.login({ email, password });
        // FIX: Save both token and user object to the store
        setAuth(res.data.user, res.data.access_token);
      } else {
        const res = await authAPI.register({ email, username, password });
        // FIX: Save both token and user object to the store
        setAuth(res.data.user, res.data.access_token);
      }
      navigate('/'); // Redirect to dashboard
      window.location.reload();
    } catch (err) {
      setError(err.response?.data?.detail || 'Authentication failed. Is the database running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-ai-blue to-ai-purple">
            <Bot className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold">AI Platform</h1>
          <p className="text-muted-foreground"></p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{isLogin ? 'Welcome back' : 'Create account'}</CardTitle>
            <CardDescription>Enter your credentials to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Username</label>
                  <Input value={username} onChange={(e) => setUsername(e.target.value)} required />
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              {error && <p className="text-sm text-ai-red">{error}</p>}
              <Button type="submit" variant="ai" className="w-full" disabled={loading}>
                {loading ? 'Connecting to Database...' : (isLogin ? 'Sign In' : 'Create Account')}
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setIsLogin(!isLogin); setError(''); }}
                  className="text-sm text-ai-blue hover:underline"
                >
                  {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}