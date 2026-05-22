import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { workspaceAPI } from '@/lib/api';
import { agentAPI } from '@/lib/api';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import python from 'react-syntax-highlighter/dist/esm/languages/hljs/python';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';
import { FolderOpen, FileCode, Trash2, X, RefreshCw, Save, Play, Pencil, Image as ImageIcon, Folder, GitCompare, Headphones, FileText } from 'lucide-react';

SyntaxHighlighter.registerLanguage('python', python);

export default function WorkspaceExplorer() {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [isImage, setIsImage] = useState(false);
  const [isAudio, setIsAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const [transcriptionText, setTranscriptionText] = useState('Loading...');
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  
  const [showDiff, setShowDiff] = useState(false);
  const [diffOldCode, setDiffOldCode] = useState('');
  const [diffNewCode, setDiffNewCode] = useState('');

  const fetchFiles = async () => {
    try {
      const res = await workspaceAPI.list();
      setFiles(res.data.files || []);
    } catch (err) { console.error("Failed to fetch workspace files:", err); }
  };

  useEffect(() => {
    fetchFiles();
    const interval = setInterval(fetchFiles, 10000);
    return () => clearInterval(interval);
  }, []);

  const openFile = async (filename) => {
    setLoading(true);
    setEditMode(false);
    setShowDiff(false);
    try {
      const res = await workspaceAPI.getContent(filename);
      setSelectedFile(filename);
      setIsImage(res.data.is_image || false);
      setIsAudio(res.data.is_audio || false);

      if (res.data.is_image) {
        setFileContent(res.data.base64);
        setEditContent('');
      } else if (res.data.is_audio) {
        setAudioUrl(res.data.stream_url);
        setFileContent('');
        setEditContent('');
        
        const txtFilename = filename.replace(/\.[^/.]+$/, "") + "_transcription.txt";
        try {
          const txtRes = await workspaceAPI.getContent(txtFilename);
          if (txtRes.data.content) {
            setTranscriptionText(txtRes.data.content);
          } else {
            setTranscriptionText("No transcription available yet.");
          }
        } catch {
          setTranscriptionText("No transcription available yet.");
        }
      } else {
        setFileContent(res.data.content);
        setEditContent(res.data.content);
      }
    } catch (err) { console.error("Failed to read file:", err); }
    finally { setLoading(false); }
  };

  const deleteFile = async (filename) => {
    if (!window.confirm(`Are you sure you want to delete ${filename}?`)) return;
    try {
      await workspaceAPI.delete(filename);
      if (selectedFile === filename) { setSelectedFile(null); setFileContent(''); setIsImage(false); setIsAudio(false); }
      fetchFiles();
    } catch (err) { console.error("Failed to delete file:", err); }
  };

  const closeViewer = () => {
    setSelectedFile(null);
    setFileContent('');
    setIsImage(false);
    setIsAudio(false);
    setEditMode(false);
    setShowDiff(false);
  };

  const handleEditToggle = () => {
    if (editMode) {
      setEditContent(fileContent); 
    }
    setEditMode(!editMode);
  };

  const handleSave = async () => {
    if (!selectedFile) return;
    setIsSaving(true);
    try {
      await workspaceAPI.update(selectedFile, editContent);
      setFileContent(editContent);
      setEditMode(false);
    } catch (err) {
      console.error("Failed to save file:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRun = async () => {
    if (!selectedFile) return;
    setIsRunning(true);
    try {
      await agentAPI.runFile(selectedFile);
    } catch (err) {
      console.error("Failed to run file:", err);
    } finally {
      setTimeout(() => setIsRunning(false), 3000);
    }
  };

  const handleSaveAndRun = async () => {
    if (!selectedFile) return;
    setIsSaving(true);
    setIsRunning(true);
    try {
      await workspaceAPI.update(selectedFile, editContent);
      setFileContent(editContent);
      setEditMode(false);
      await agentAPI.runFile(selectedFile);
    } catch (err) {
      console.error("Failed to save/run file:", err);
    } finally {
      setIsSaving(false);
      setTimeout(() => setIsRunning(false), 3000);
    }
  };

  const buildTree = (files) => {
    const root = {};
    files.forEach(file => {
      const parts = file.name.split('/');
      let current = root;
      parts.forEach((part, index) => {
        if (!current[part]) {
          current[part] = index === parts.length - 1 ? null : {};
        }
        current = current[part] || {};
      });
    });
    return root;
  };

  const renderTree = (node, path = '') => {
    return Object.keys(node).map(name => {
      const isDir = node[name] !== null;
      const fullPath = path ? `${path}/${name}` : name;
      
      if (isDir) {
        return (
          <div key={fullPath}>
            <div className="flex items-center gap-2 p-2 text-gray-400 hover:bg-gray-800 rounded-md cursor-pointer">
              <Folder className="h-4 w-4 text-ai-blue shrink-0" />
              <span className="text-xs font-medium">{name}</span>
            </div>
            <div className="ml-4 border-l border-gray-800 pl-2">
              {renderTree(node[name], fullPath)}
            </div>
          </div>
        );
      }
      
      const fileData = files.find(f => f.name === fullPath);
      return (
        <div
          key={fullPath}
          className={`flex items-center justify-between p-2 rounded-md cursor-pointer group transition-colors ${
            selectedFile === fullPath ? 'bg-ai-blue/20 text-white' : 'hover:bg-gray-800 text-gray-400'
          }`}
          onClick={() => openFile(fullPath)}
        >
          <div className="flex items-center gap-2 min-w-0">
            {fullPath.toLowerCase().match(/\.(png|jpg|jpeg|gif|webp)$/) ? (
              <ImageIcon className="h-4 w-4 text-ai-purple shrink-0" />
            ) : fullPath.toLowerCase().match(/\.(mp3|wav|m4a|flac|ogg)$/) ? (
              <Headphones className="h-4 w-4 text-ai-orange shrink-0" />
            ) : (
              <FileCode className="h-4 w-4 text-ai-green shrink-0" />
            )}
            <span className="text-xs truncate">{name}</span>
          </div>
          <div className="flex items-center gap-2">
            {fileData && <Badge variant="outline" className="text-[9px] border-gray-700 text-gray-500 hidden md:inline-block">{fileData.size_kb} KB</Badge>}
            <button
              onClick={(e) => { e.stopPropagation(); deleteFile(fullPath); }}
              className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-ai-red transition-all"
              title="Delete file"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      );
    });
  };

  const treeData = buildTree(files);

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* File Tree */}
      <Card className="md:col-span-1 bg-[#0d1117] border-gray-800">
        <CardHeader className="flex flex-row items-center justify-between border-b border-gray-800 pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-gray-300">
            <FolderOpen className="h-4 w-4 text-ai-blue" /> Workspace
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchFiles} className="text-gray-500 hover:text-gray-300 h-6 w-6 p-0">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <CardContent className="p-2">
          <ScrollArea className="h-[400px]">
            {files.length === 0 ? (
              <div className="text-center text-gray-600 text-xs p-4 mt-10">No files yet. Execute a task first.</div>
            ) : (
              renderTree(treeData)
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Code Viewer / Editor / Diff Viewer / Image / Audio Viewer */}
      <Card className="md:col-span-2 bg-[#0d1117] border-gray-800">
        <CardHeader className="flex flex-row items-center justify-between border-b border-gray-800 pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-gray-300">
            {isImage ? <ImageIcon className="h-4 w-4 text-ai-purple" /> : 
             isAudio ? <Headphones className="h-4 w-4 text-ai-orange" /> : 
             <FileCode className="h-4 w-4 text-ai-purple" />}
            {selectedFile || 'Viewer'}
          </CardTitle>
          {selectedFile && (
            <div className="flex gap-2">
              {/* FIX: ALWAYS SHOW DELETE BUTTON WHEN A FILE IS SELECTED */}
              <Button variant="outline" size="sm" onClick={() => deleteFile(selectedFile)} className="text-ai-red border-ai-red/30 hover:bg-ai-red/10">
                <Trash2 className="h-3 w-3 mr-1" /> Delete
              </Button>

              {!isImage && !isAudio && !editMode && !showDiff && (
                <>
                  <Button variant="outline" size="sm" onClick={handleRun} disabled={isRunning} className="text-ai-green border-ai-green/30">
                    <Play className="h-3 w-3 mr-1" /> {isRunning ? 'Running...' : 'Run in Docker'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleEditToggle} className="text-ai-blue border-ai-blue/30">
                    <Pencil className="h-3 w-3 mr-1" /> Edit
                  </Button>
                </>
              )}
              {editMode && (
                <>
                  <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving} className="text-ai-green border-ai-green/30">
                    <Save className="h-3 w-3 mr-1" /> {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                  <Button variant="ai" size="sm" onClick={handleSaveAndRun} disabled={isSaving || isRunning} className="h-8 text-xs">
                    <Play className="h-3 w-3 mr-1" /> {isRunning ? 'Running...' : 'Save & Run'}
                  </Button>
                </>
              )}
              <Button variant="ghost" size="sm" onClick={closeViewer} className="text-gray-500 hover:text-white h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px] bg-[#1e1e2e]">
            {loading ? (
              <div className="flex justify-center items-center h-full text-gray-500 text-sm">Loading...</div>
            ) : selectedFile ? (
              isImage ? (
                <div className="flex items-center justify-center p-4 h-full">
                  <img src={fileContent} alt={selectedFile} className="max-w-full max-h-[380px] object-contain rounded-md" />
                </div>
              ) : isAudio ? (
                <div className="flex flex-col h-full p-6 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="rounded-full bg-ai-orange/10 p-4">
                      <Headphones className="h-8 w-8 text-ai-orange" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-200">{selectedFile}</h3>
                      <p className="text-sm text-gray-500">Local Whisper Transcription Player</p>
                    </div>
                  </div>
                  
                  <audio controls className="w-full mt-4" key={audioUrl}>
                    <source src={audioUrl} type="audio/mpeg" />
                    Your browser does not support the audio element.
                  </audio>

                  <div className="flex-1 bg-black/40 p-4 rounded-md border border-gray-800 mt-4 overflow-y-auto">
                    <div className="flex items-center gap-2 mb-3 text-ai-cyan">
                      <FileText className="h-4 w-4" />
                      <span className="font-bold text-sm">Transcription</span>
                    </div>
                    <pre className="whitespace-pre-wrap font-sans text-sm text-gray-300 leading-relaxed">
                      {transcriptionText}
                    </pre>
                  </div>
                </div>
              ) : showDiff ? (
                <div className="p-4">
                  <ReactDiffViewer
                    oldValue={diffOldCode}
                    newValue={diffNewCode}
                    splitView={true}
                    compareMethod={DiffMethod.WORDS}
                    useDarkTheme={true}
                    styles={{
                      variables: { dark: { diffViewerBackground: '#1e1e2e', gutterBackground: '#0d1117' } }
                    }}
                  />
                </div>
              ) : editMode ? (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full h-full min-h-[400px] bg-transparent text-gray-200 font-mono text-sm p-4 border-0 focus:outline-none focus:ring-0"
                  spellCheck="false"
                />
              ) : (
                <SyntaxHighlighter
                  language="python"
                  style={atomOneDark}
                  showLineNumbers={true}
                  wrapLines={true}
                  customStyle={{ background: 'transparent', margin: 0, padding: '1rem', fontSize: '0.8rem' }}
                >
                  {fileContent}
                </SyntaxHighlighter>
              )
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-600 text-sm mt-20">
                <FileCode className="h-12 w-12 mb-4 text-gray-700" />
                Select a file to view or edit its code
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}