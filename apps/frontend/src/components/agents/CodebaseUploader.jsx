import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { projectAPI } from '@/lib/api';
import { Upload, FileArchive, Loader2, CheckCircle, AlertCircle, Github } from 'lucide-react';

export default function CodebaseUploader({ onProjectAnalyzed }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [githubUrl, setGithubUrl] = useState('');
  const fileInputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file || !file.name.endsWith('.zip')) {
      setUploadStatus({ type: 'error', message: 'Only .zip files are allowed.' });
      return;
    }
    setIsUploading(true);
    setUploadStatus(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await projectAPI.upload(formData);
      setUploadStatus({ type: 'success', message: `Embedded ${res.data.file_count || 'all'} files!` });
      if (onProjectAnalyzed) onProjectAnalyzed(res.data);
    } catch (err) {
      setUploadStatus({ type: 'error', message: err.response?.data?.detail || 'Upload failed.' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleGithubClone = async () => {
    if (!githubUrl.trim() || !githubUrl.includes('github.com')) {
      setUploadStatus({ type: 'error', message: 'Please enter a valid GitHub URL.' });
      return;
    }
    setIsUploading(true);
    setUploadStatus(null);
    try {
      const res = await projectAPI.githubClone(githubUrl);
      setUploadStatus({ type: 'success', message: `Cloning & Embedding started for ${res.data.name}!` });
      if (onProjectAnalyzed) onProjectAnalyzed(res.data);
      setGithubUrl('');
    } catch (err) {
      setUploadStatus({ type: 'error', message: err.response?.data?.detail || 'Failed to clone repo.' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <Card className="bg-[#0d1117] border-gray-800">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-gray-300">
          <FileArchive className="h-4 w-4 text-ai-orange" /> Codebase Context
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* GitHub Clone Input */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Github className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
            <Input
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/user/repo"
              className="pl-8 h-8 text-xs bg-background border-gray-700"
              onKeyDown={(e) => e.key === 'Enter' && handleGithubClone()}
            />
          </div>
          <Button variant="ai" size="sm" onClick={handleGithubClone} disabled={isUploading} className="h-8 text-xs">
            {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Clone'}
          </Button>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-gray-600">
          <div className="flex-1 h-px bg-gray-800"></div>
          <span>OR</span>
          <div className="flex-1 h-px bg-gray-800"></div>
        </div>

        {/* Zip Upload Dropzone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => fileInputRef.current.click()}
          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${
            isDragging ? 'border-ai-blue bg-ai-blue/10' : 'border-gray-700 hover:border-gray-500'
          }`}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".zip"
            onChange={(e) => e.target.files && handleFile(e.target.files[0])}
          />
          {isUploading ? (
            <div className="flex flex-col items-center gap-1">
              <Loader2 className="h-6 w-6 text-ai-blue animate-spin" />
              <p className="text-xs text-gray-400">Embedding Codebase...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <Upload className="h-6 w-6 text-gray-500" />
              <p className="text-xs text-gray-400">Drag & Drop <span className="text-ai-orange font-bold">.zip</span></p>
            </div>
          )}
        </div>

        {uploadStatus && (
          <div className={`flex items-center gap-2 text-xs p-2 rounded-md ${
            uploadStatus.type === 'success' ? 'bg-ai-green/10 text-ai-green' : 'bg-ai-red/10 text-ai-red'
          }`}>
            {uploadStatus.type === 'success' ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
            {uploadStatus.message}
          </div>
        )}
      </CardContent>
    </Card>
  );
}