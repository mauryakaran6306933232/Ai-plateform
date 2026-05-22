import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { jarvisAPI, memoryAPI } from '@/lib/api';
import { Brain, Search, Database, Cpu, Sparkles, Network } from 'lucide-react';
import { DataSet, Network as VisNetwork } from 'vis-network/standalone';

export default function Memory() {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showGraph, setShowGraph] = useState(false);
  
  const graphRef = useRef(null);

  useEffect(() => {
    loadMemories();
  }, []);

  const loadMemories = async () => {
    try {
      setLoading(true);
      const res = await jarvisAPI.memory();
      setMemories(res.data.memories || []);
    } catch (err) {
      console.error('Failed to load memories:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const res = await memoryAPI.search(searchQuery);
      setSearchResults(res.data.results || []);
    } catch (err) {
      console.error('Memory search failed:', err);
    }
  };

  const displayMemories = searchResults.length > 0 ? searchResults.map(r => ({ id: r, text: r })) : memories;

  // NEW: Vis.js Force Graph Initialization
  useEffect(() => {
    if (showGraph && graphRef.current && memories.length > 0) {
      const nodes = new DataSet(
        memories.map((mem, idx) => ({
          id: idx,
          label: mem.text.substring(0, 30) + '...',
          title: mem.text, // Hover text
          color: {
            background: mem.metadata?.type === 'user_input' ? '#3b82f6' : 
                        mem.metadata?.type === 'jarvis_response' ? '#8b5cf6' : '#10b981',
            border: '#1e1e2e',
            highlight: { background: '#ef4444', border: '#1e1e2e' }
          },
          font: { color: '#ffffff', size: 10 },
          shape: 'dot',
          size: 15
        }))
      );

      const edges = new DataSet([]);
      // Simple edge creation: Connect sequential memories or same type
      for (let i = 1; i < memories.length; i++) {
        if (memories[i].metadata?.type === memories[i-1].metadata?.type) {
          edges.add({ from: i-1, to: i, color: { color: '#333', highlight: '#ef4444' } });
        }
      }

      const data = { nodes, edges };
      const options = {
        physics: {
          stabilization: { iterations: 100 },
          barnesHut: { gravitationalConstant: -2000, centralGravity: 0.3, springLength: 95 }
        },
        interaction: { hover: true, tooltipDelay: 200 },
      };

      const network = new VisNetwork(graphRef.current, data, options);
    }
  }, [showGraph, memories]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Memory System</h1>
          <p className="text-muted-foreground mt-1">
            Jarvis's persistent long-term memory powered by ChromaDB
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={showGraph ? "ai" : "outline"} onClick={() => setShowGraph(!showGraph)}>
            <Network className="h-4 w-4 mr-2" /> {showGraph ? 'List View' : 'Knowledge Graph'}
          </Button>
          <Badge variant="purple" className="text-sm py-1 px-3">
            <Database className="h-4 w-4 mr-2" /> ChromaDB Active
          </Badge>
        </div>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Semantic search through Jarvis's memories..."
                className="pl-10 bg-background"
              />
            </div>
            <Button variant="ai" onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" /> Search
            </Button>
            {searchResults.length > 0 && (
              <Button variant="outline" onClick={() => { setSearchResults([]); setSearchQuery(''); }}>
                Clear Search
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Memory Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg p-2 bg-ai-purple/10"><Brain className="h-5 w-5 text-ai-purple" /></div>
              <div>
                <p className="text-2xl font-bold">{memories.length}</p>
                <p className="text-xs text-muted-foreground">Total Memories</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg p-2 bg-ai-blue/10"><Cpu className="h-5 w-5 text-ai-blue" /></div>
              <div>
                <p className="text-2xl font-bold">Local</p>
                <p className="text-xs text-muted-foreground">Processing</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg p-2 bg-ai-green/10"><Sparkles className="h-5 w-5 text-ai-green" /></div>
              <div>
                <p className="text-2xl font-bold">Ollama</p>
                <p className="text-xs text-muted-foreground">Embeddings</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* NEW: Knowledge Graph View */}
      {showGraph ? (
        <Card className="bg-[#0d1117] border-gray-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-gray-300">
              <Network className="h-4 w-4 text-ai-blue" /> Neural Knowledge Graph
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div ref={graphRef} className="h-[500px] w-full bg-[#1e1e2e] rounded-md border border-gray-800" />
          </CardContent>
        </Card>
      ) : (
        // Original List View
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {searchResults.length > 0 ? 'Search Results' : 'All Memories'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-ai-purple border-t-transparent" />
              </div>
            ) : displayMemories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No memories stored yet. Start chatting with Jarvis!
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {displayMemories.map((mem, idx) => (
                  <div
                    key={mem.id || idx}
                    className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <p className="text-sm">{mem.text}</p>
                    {mem.metadata && (
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline" className="text-[10px]">
                          {mem.metadata.type || 'memory'}
                        </Badge>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}