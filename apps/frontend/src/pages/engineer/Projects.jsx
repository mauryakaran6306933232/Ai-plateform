import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { projectAPI } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import {
 GitBranch, Plus, Search, Loader2, CheckCircle, AlertCircle,
 Globe, FileCode, X, ChevronDown, ChevronUp, Database, Trash2, WifiOff
} from 'lucide-react';

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(""); // NEW
  const [githubUrl, setGithubUrl] = useState('');
  const [isCloning, setIsCloning] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Search state
  const [searchProjectId, setSearchProjectId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setIsLoading(true);
    setFetchError(""); // Reset error on retry
    try {
      const res = await projectAPI.list();
      setProjects(res.data.projects || []);
    } catch (err) {
      console.error("Failed to fetch projects:", err);
      // FIX: Set a user-friendly error message
      if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
        setFetchError("Database connection timed out. Please ensure PostgreSQL and the backend are running.");
      } else if (err.message === "Network Error") {
        setFetchError("Backend server is unreachable. Please start the FastAPI server.");
      } else {
        setFetchError("Failed to load projects. Check your database connection.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGithubClone = async () => {
    if (!githubUrl.trim() || !githubUrl.includes('github.com')) return;
    setIsCloning(true);
    try {
      await projectAPI.githubClone(githubUrl);
      setGithubUrl('');
      setTimeout(() => fetchProjects(), 1000);
    } catch (err) {
      console.error("Failed to clone repo:", err);
    } finally {
      setIsCloning(false);
    }
  };

  const handleDeleteProject = async (projectId, projectName) => {
    if (!window.confirm(`Are you sure you want to delete ${projectName} and its vector memory?`)) return;
    setDeletingId(projectId);
    try {
      await projectAPI.delete(projectId);
      fetchProjects(); 
    } catch (err) {
      console.error("Failed to delete project:", err);
      alert("Failed to delete project. Check console for details.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSearch = async (projectId) => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchResults([]);
    try {
      const res = await projectAPI.search(projectId, searchQuery);
      setSearchResults(res.data.results || []);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const toggleSearch = (projectId) => {
    if (searchProjectId === projectId) {
      setSearchProjectId(null);
      setSearchQuery('');
      setSearchResults([]);
    } else {
      setSearchProjectId(projectId);
      setSearchQuery('');
      setSearchResults([]);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'analyzed': return <Badge variant="success" className="text-[10px]"><CheckCircle className="h-3 w-3 mr-1" /> Analyzed</Badge>;
      case 'analyzing': return <Badge variant="warning" className="text-[10px] animate-pulse"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Analyzing</Badge>;
      case 'error': return <Badge variant="destructive" className="text-[10px]"><AlertCircle className="h-3 w-3 mr-1" /> Error</Badge>;
      default: return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects & Codebases</h1>
          <p className="text-muted-foreground mt-1">Manage repositories and semantic code search</p>
        </div>
      </div>

      {/* GitHub Clone Input */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/user/repo"
                className="pl-10 bg-background"
                onKeyDown={(e) => e.key === 'Enter' && handleGithubClone()}
              />
            </div>
            <Button variant="ai" onClick={handleGithubClone} disabled={isCloning || !githubUrl.trim()}>
              {isCloning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <GitBranch className="h-4 w-4 mr-2" />}
              Clone & Embed
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Cloning will parse the code, generate embeddings, and inject context into the AI Engineer.
          </p>
        </CardContent>
      </Card>

      {/* Projects Grid or Error State */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-ai-blue" />
        </div>
      ) : fetchError ? (
        // FIX: Show friendly Database Offline error instead of blank screen
        <Card className="flex flex-col items-center justify-center py-20 text-center border-ai-red/30">
          <WifiOff className="h-12 w-12 text-ai-red mb-4" />
          <h3 className="text-lg font-semibold mb-2 text-ai-red">Connection Error</h3>
          <p className="text-sm text-muted-foreground max-w-md mb-4">{fetchError}</p>
          <Button variant="outline" onClick={fetchProjects}>
            Retry Connection
          </Button>
        </Card>
      ) : projects.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-20 text-center">
          <Database className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Projects Yet</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Clone a GitHub repository or upload a .zip file from the AI Engineer tab to create your first codebase context.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <motion.div key={project.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="hover:border-ai-blue/30 transition-all flex flex-col h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {project.repo_url ? (
                        <GitBranch className="h-4 w-4 text-ai-purple" />
                      ) : (
                        <FileCode className="h-4 w-4 text-ai-blue" />
                      )}
                      <CardTitle className="text-base">{project.name}</CardTitle>
                    </div>
                    {getStatusBadge(project.status)}
                  </div>
                  {project.repo_url && (
                    <CardDescription className="text-[10px] truncate mt-1">
                      {project.repo_url}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between space-y-3">
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>Files: <span className="text-foreground font-mono">{project.file_count || 0}</span></span>
                    <span>Lang: <span className="text-foreground font-mono">{project.language || 'N/A'}</span></span>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2 border-t border-border">
                    {project.status === 'analyzed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => toggleSearch(project.id)}
                      >
                        <Search className="h-3 w-3 mr-1" />
                        {searchProjectId === project.id ? 'Hide Search' : 'Search Code'}
                      </Button>
                    )}
                    
                    {project.repo_url && (
                      <Badge variant="purple" className="text-[9px] h-7 flex items-center">
                        PR Ready
                      </Badge>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs text-ai-red border-ai-red/30 hover:bg-ai-red/10"
                      onClick={() => handleDeleteProject(project.id, project.name)}
                      disabled={deletingId === project.id}
                    >
                      {deletingId === project.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    </Button>
                  </div>

                  {/* Inline Search Expansion */}
                  {searchProjectId === project.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="space-y-2 pt-2 border-t border-border"
                    >
                      <div className="flex gap-2">
                        <Input
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Semantic search..."
                          className="h-8 text-xs bg-background"
                          onKeyDown={(e) => e.key === 'Enter' && handleSearch(project.id)}
                        />
                        <Button
                          size="sm"
                          variant="ai"
                          className="h-8 w-8 p-0"
                          onClick={() => handleSearch(project.id)}
                          disabled={isSearching}
                        >
                          {isSearching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                        </Button>
                      </div>

                      {searchResults.length > 0 && (
                        <div className="max-h-[150px] overflow-y-auto space-y-1 bg-black/30 rounded-md p-2">
                          {searchResults.map((res, idx) => (
                            <div key={idx} className="text-[10px] text-muted-foreground border-b border-border pb-1">
                              <span className="text-ai-cyan font-mono block mb-0.5">
                                {res.metadata?.filename || 'Unknown File'}
                              </span>
                              <span className="line-clamp-2">{res.content.substring(0, 100)}...</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}