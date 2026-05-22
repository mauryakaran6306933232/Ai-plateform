import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { jarvisAPI } from '@/lib/api';
import socketManager from '@/lib/socket';
import { 
  Send, Bot, User, Sparkles, Activity, Play, Cpu, Mic, MicOff, 
  Volume2, VolumeX, Radio, Search, Bug, Square, StopCircle 
} from 'lucide-react';

const modes = [
  { id: 'default', label: 'Default', icon: Sparkles, color: 'blue' },
  { id: 'focus', label: 'Focus', icon: Cpu, color: 'green' },
  { id: 'research', label: 'Research', icon: Search, color: 'purple' },
  { id: 'debug', label: 'Debug', icon: Bug, color: 'orange' },
];

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [continuousMode, setContinuousMode] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [micLevel, setMicLevel] = useState(0);
  const [activeMode, setActiveMode] = useState('default');

  const scrollRef = useRef(null);
  const recognitionRef = useRef(null);
  const timeoutRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const isStoppedRef = useRef(false);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await jarvisAPI.getHistory();
        if (res.data.conversations && res.data.conversations.length > 0) {
          setMessages(res.data.conversations[0].messages || []);
        }
      } catch (err) { console.error("Failed to load history:", err); }
      finally { setIsLoading(false); }
    };
    loadHistory();
    return () => { stopListening(); };
  }, []);

  useEffect(() => {
    return () => {
      if (messages.length > 0) {
        jarvisAPI.saveConversation({ messages }).catch(err => console.error(err));
      }
    };
  }, [messages]);

  const speakText = (text) => {
    if (!ttsEnabled || !text) return;
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/```[\s\S]*?```/g, ' code block omitted ')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/```/g, '')
      .replace(/---/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.1;
    utterance.pitch = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(voice => voice.name.includes('Google US English')) || voices.find(voice => voice.lang === 'en-US');
    if (preferredVoice) utterance.voice = preferredVoice;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      if (continuousMode && !isThinking) {
        setTimeout(() => toggleListening(), 500);
      }
    };
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    const handleResponse = (data) => {
      if (isStoppedRef.current && data.status === 'streaming') return;

      if (data.status === 'thinking') {
        setIsThinking(true);
        window.speechSynthesis.cancel();
        if (isListening) stopListening();
        setMessages(prev => [...prev, { role: 'jarvis', text: '', thinking: true }]);
      } else if (data.status === 'streaming') {
        setIsThinking(true);
        setMessages(prev => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg && lastMsg.role === 'jarvis') {
            updated[updated.length - 1] = { ...lastMsg, text: lastMsg.text + data.token, thinking: false };
            return updated;
          } else {
            updated.push({ role: 'jarvis', text: data.token, thinking: false });
            return updated;
          }
        });
      } else if (data.status === 'done' || data.status === 'error') {
        setIsThinking(false);
        setMessages(prev => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg && lastMsg.thinking) updated[updated.length - 1] = { ...lastMsg, thinking: false };
          if (lastMsg && lastMsg.role === 'jarvis' && lastMsg.text) {
            speakText(lastMsg.text);
          }
          return updated;
        });
      }
    };

    const handleNotification = (data) => {
      if (data.status === 'auto_fix_complete') {
        setMessages(prev => [...prev, { role: 'jarvis', text: data.message, thinking: false }]);
        setIsThinking(false);
        speakText(data.message);
      }
    };

    socketManager.on('jarvis:response', handleResponse);
    socketManager.on('jarvis:notification', handleNotification);
    return () => {
      socketManager.off('jarvis:response', handleResponse);
      socketManager.off('jarvis:notification', handleNotification);
    };
  }, [ttsEnabled, continuousMode]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleStopGeneration = () => {
    isStoppedRef.current = true;
    setIsThinking(false);
    window.speechSynthesis.cancel();
    setMessages(prev => {
      const updated = [...prev];
      const lastMsg = updated[updated.length - 1];
      if (lastMsg && lastMsg.thinking) {
        updated[updated.length - 1] = { ...lastMsg, thinking: false, text: "[Generation Stopped]" };
      }
      return updated;
    });
  };

  const sendMessage = async (overrideMsg) => {
    const textToSend = overrideMsg || input;
    if (!textToSend.trim() || isThinking) return;
    
    isStoppedRef.current = false;
    setInput('');
    setVoiceError('');
    window.speechSynthesis.cancel();
    setMessages(prev => [...prev, { role: 'user', text: textToSend }]);
    try { await jarvisAPI.chat(textToSend, null, activeMode); } catch (err) { console.error(err); }
  };

  const startMicrophoneVisualizer = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      mediaStreamRef.current = stream;
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const average = sum / dataArray.length;
        setMicLevel(Math.min(100, Math.round((average / 40) * 100)));
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (err) {
      console.error("Mic visualizer error:", err);
      setVoiceError("Could not access microphone. Check browser permissions.");
    }
  };

  const stopMicrophoneVisualizer = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach(track => track.stop());
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') audioContextRef.current.close();
    setMicLevel(0);
  };

  const toggleListening = async () => {
    if (isListening) { stopListening(); return; }
    setVoiceError(''); setInput('');

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError("Voice not supported. Please use Chrome or Edge.");
      return;
    }

    await startMicrophoneVisualizer();
    if (recognitionRef.current) recognitionRef.current.abort();
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
      setIsListening(true);
      window.speechSynthesis.cancel();
      timeoutRef.current = setTimeout(() => {
        if (recognitionRef.current) recognitionRef.current.stop();
      }, 10000);
    };

    recognition.onresult = (event) => {
      clearTimeout(timeoutRef.current);
      let interimTranscript = '', finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
        else interimTranscript += event.results[i][0].transcript;
      }
      if (finalTranscript) {
        setInput(finalTranscript);
        stopListening();
        setTimeout(() => sendMessage(finalTranscript), 300);
      }
      else if (interimTranscript) setInput(interimTranscript);
    };

    recognition.onerror = (event) => {
      clearTimeout(timeoutRef.current);
      if (event.error === 'not-allowed') setVoiceError("Mic permission denied.");
      else if (event.error === 'no-speech') setVoiceError("No speech detected. Try again.");
      else if (event.error !== 'aborted') setVoiceError(`Voice error: ${event.error}.`);
      stopListening();
    };

    recognition.onend = () => {
      clearTimeout(timeoutRef.current);
      setIsListening(false);
      recognitionRef.current = null;
      stopMicrophoneVisualizer();
    };

    try {
      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error("Failed to start recognition:", e);
      stopListening();
    }
  };

  const stopListening = () => {
    clearTimeout(timeoutRef.current);
    if (recognitionRef.current) { recognitionRef.current.abort(); recognitionRef.current = null; }
    stopMicrophoneVisualizer();
    setIsListening(false);
  };

  if (isLoading) return (
    <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-6rem)]">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg p-2 bg-blue-600/10"><Sparkles className="h-5 w-5 text-blue-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Jarvis AI OS</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">Voice I/O • Persistent Memory • Action Agent</p>
          </div>
        </div>
        <div className="flex gap-2 ml-auto flex-wrap">
          {isThinking && <Badge variant="info" className="animate-pulse"><Activity className="h-3 w-3 mr-1"/>Thinking</Badge>}
          {isSpeaking && <Badge variant="purple" className="animate-pulse"><Volume2 className="h-3 w-3 mr-1"/>Speaking</Badge>}
          {continuousMode && <Badge variant="success" className="animate-pulse"><Radio className="h-3 w-3 mr-1"/>Hands-Free</Badge>}
        </div>
      </div>

      {/* Jarvis Mode Toggles */}
      <div className="flex gap-2 mb-4 border-b border-gray-200 dark:border-gray-800 pb-4 overflow-x-auto">
        {modes.map(mode => (
          <Button
            key={mode.id}
            variant={activeMode === mode.id ? 'default' : 'outline'}
            size="sm"
            className={`${activeMode === mode.id ? 'bg-blue-600 text-white hover:bg-blue-700' : `text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white`}`}
            onClick={() => setActiveMode(mode.id)}
          >
            <mode.icon className="h-4 w-4 mr-2" />
            {mode.label}
          </Button>
        ))}
      </div>

      {/* Main Chat Area */}
      <Card className="flex-1 flex flex-col bg-slate-50 dark:bg-[#0d1117] border-gray-200 dark:border-gray-800 overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-600 space-y-6">
              <Bot className="h-16 w-16" />
              <p className="text-xl font-bold text-gray-800 dark:text-gray-200">Jarvis is online. ({activeMode.toUpperCase()} MODE)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md mt-4">
                <button onClick={() => sendMessage("Jarvis, check the system status")} className="flex items-center gap-2 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors text-sm text-gray-800 dark:text-gray-200">
                  <Cpu className="h-4 w-4 text-blue-600" /> System Status
                </button>
                <button onClick={() => sendMessage("Jarvis, search the web for the latest AI news")} className="flex items-center gap-2 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors text-sm text-gray-800 dark:text-gray-200">
                  <Play className="h-4 w-4 text-blue-600" /> Search Web
                </button>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'jarvis' && (
                  <div className="h-8 w-8 rounded-full bg-blue-600/20 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="h-4 w-4 text-blue-600" />
                  </div>
                )}
                {/* FIX: Using !important (!) modifiers to permanently override any conflicting CSS variables */}
                <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                  msg.role === 'user'
                    ? '!bg-indigo-600 !text-white rounded-br-none' 
                    : '!bg-white !text-gray-900 border border-gray-200 dark:!bg-gray-800 dark:!text-gray-100 dark:border-gray-700 rounded-bl-none' 
                }`}>
                  {msg.thinking ? (
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                      <div className="h-2 w-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="h-2 w-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="h-2 w-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  ) : (
                    <pre className="whitespace-pre-wrap font-sans !text-inherit">{msg.text}</pre>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="h-8 w-8 rounded-full bg-indigo-600/20 flex items-center justify-center shrink-0 mt-1">
                    <User className="h-4 w-4 text-indigo-600" />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </Card>

      {voiceError && (<div className="mt-2 text-xs text-red-600 bg-red-100 p-2 rounded-md border border-red-200">{voiceError}</div>)}

      {/* Audio Level Indicator Bar */}
      {isListening && micLevel > 0 && (
        <div className="w-full h-1 bg-gray-200 dark:bg-gray-800 rounded-full mt-2 overflow-hidden">
          <div 
            className="h-full bg-blue-600 transition-all duration-100" 
            style={{ width: `${micLevel}%` }}
          ></div>
        </div>
      )}

      {/* Bottom Bar */}
      <div className="mt-4 flex gap-2 items-center relative">
        <Input
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          onKeyDown={(e) => e.key === 'Enter' && !isThinking && sendMessage()} 
          placeholder={isListening ? "Speak now..." : `Message Jarvis (${activeMode} mode)...`}
          className={`flex-1 !bg-white !text-gray-900 border-gray-300 dark:!bg-[#1e1e2e] dark:!text-white transition-all ${isListening ? 'border-blue-600 ring-2 ring-blue-600/30' : ''}`}
          disabled={isThinking}
        />
        
        {isThinking ? (
          <Button variant="destructive" size="icon" onClick={handleStopGeneration} className="shrink-0">
            <Square className="h-5 w-5" />
          </Button>
        ) : (
          <Button variant="default" size="icon" onClick={() => sendMessage()} disabled={!input.trim()} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Send className="h-4 w-4" />
          </Button>
        )}

        {isSpeaking && (
          <Button variant="outline" size="icon" onClick={() => window.speechSynthesis.cancel()} className="shrink-0 text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20">
            <StopCircle className="h-5 w-5" />
          </Button>
        )}

        <div className="relative hidden md:flex items-center gap-1">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={toggleListening} 
            className={`relative z-10 transition-all ${isListening ? 'text-red-600 hover:bg-red-50 border-red-300 bg-red-50 animate-pulse dark:text-red-400 dark:hover:bg-red-900/20 dark:border-red-800 dark:bg-red-900/20' : ''}`}
          >
            {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
          
          <Button variant="outline" size="icon" onClick={() => { setTtsEnabled(!ttsEnabled); if (ttsEnabled) window.speechSynthesis.cancel(); }}>
            {ttsEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const newState = !continuousMode;
              setContinuousMode(newState);
              if (!newState && isListening) stopListening();
            }}
            className={`${continuousMode ? 'text-green-600 hover:bg-green-50 border-green-300 bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20 dark:border-green-800 dark:bg-green-900/20' : ''}`}
            title={continuousMode ? "Disable Hands-Free Mode" : "Enable Hands-Free Mode"}
          >
            <Radio className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Mobile Bottom Controls */}
      <div className="mt-2 md:hidden flex gap-2">
        <Button
          variant={isListening ? "destructive" : "outline"}
          className="flex-1"
          onClick={toggleListening}
        >
          {isListening ? <><MicOff className="h-4 w-4 mr-2" /> Stop Mic</> : <><Mic className="h-4 w-4 mr-2" /> Push to Talk</>}
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => { setTtsEnabled(!ttsEnabled); if (ttsEnabled) window.speechSynthesis.cancel(); }}>
          {ttsEnabled ? <><Volume2 className="h-4 w-4 mr-2" /> Mute</> : <><VolumeX className="h-4 w-4 mr-2" /> Unmute</>}
        </Button>
      </div>
    </div>
  );
}