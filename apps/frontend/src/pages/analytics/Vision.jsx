import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Camera, Scan, Video, VideoOff, Cpu, Loader2, Smile, Bell, BellOff } from 'lucide-react';
import socketManager from '@/lib/socket'; 

// Import TensorFlow.js, COCO-SSD, and the MODERN Face-API
import '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as faceapi from '@vladmandic/face-api';

export default function Vision() {
  const [predictions, setPredictions] = useState([]);
  const [cameraActive, setCameraActive] = useState(false);
  const [cocoModel, setCocoModel] = useState(null);
  const [faceModelsLoaded, setFaceModelsLoaded] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [inferenceTime, setInferenceTime] = useState(0);

  // Proactive Alert State
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const lastAlertTime = useRef(0); // Throttle alerts

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const animationRef = useRef(null);
  const containerRef = useRef(null);

  // 1. LOAD REAL ML MODELS
  useEffect(() => {
    const loadModels = async () => {
      try {
        const loadedCoco = await cocoSsd.load();
        setCocoModel(loadedCoco);

        const MODEL_URL = '/models';
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
        setFaceModelsLoaded(true);
        setIsModelLoading(false);
      } catch (err) {
        console.error("Failed to load ML models:", err);
        setIsModelLoading(false);
      }
    };
    loadModels();
  }, []);

  // 2. WEBCAM LOGIC
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraActive(true);
      }
    } catch (err) {
      alert("Please allow camera permissions to use the live vision feed.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
      streamRef.current = null;
      setCameraActive(false);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    }
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // ==========================================
  // 3. VISION ALERT EMITTER
  // ==========================================
  const emitVisionAlert = (label, confidence) => {
    if (!alertsEnabled) return;

    const now = Date.now();
    // Throttle: Only 1 alert per 30 seconds per label
    if (now - lastAlertTime.current < 30000) return;

    // Only alert on specific important things
    const alertTriggers = ["angry", "sad", "fearful", "cell phone", "scissors"];
    if (alertTriggers.includes(label.toLowerCase())) {
      lastAlertTime.current = now;

      // Emit to Backend via WebSocket
      socketManager.emit('vision:alert', {
        label: label,
        confidence: Math.round(confidence * 100),
        timestamp: new Date().toISOString()
      });
    }
  };

  // 4. REAL-TIME INFERENCE LOOP
  useEffect(() => {
    if (!cocoModel || !faceModelsLoaded || !cameraActive || !videoRef.current) return;

    const detectFrame = async () => {
      if (videoRef.current && videoRef.current.readyState === 4 && containerRef.current) {
        const video = videoRef.current;
        const container = containerRef.current;
        const startTime = performance.now();

        const [cocoPreds, facePreds] = await Promise.all([
          cocoModel.detect(video),
          faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()).withFaceExpressions()
        ]);

        const endTime = performance.now();
        setInferenceTime(Math.round(endTime - startTime));

        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;

        if (videoWidth === 0 || videoHeight === 0) {
          animationRef.current = requestAnimationFrame(detectFrame);
          return;
        }

        const containerAspect = containerWidth / containerHeight;
        const videoAspect = videoWidth / videoHeight;
        let renderedWidth, renderedHeight, offsetX, offsetY;

        if (videoAspect > containerAspect) {
          renderedWidth = containerWidth;
          renderedHeight = containerWidth / videoAspect;
          offsetX = 0;
          offsetY = (containerHeight - renderedHeight) / 2;
        } else {
          renderedHeight = containerHeight;
          renderedWidth = containerHeight * videoAspect;
          offsetX = (containerWidth - renderedWidth) / 2;
          offsetY = 0;
        }

        const scaleXFactor = renderedWidth / videoWidth;
        const scaleYFactor = renderedHeight / videoHeight;

        const formattedPreds = [];

        cocoPreds.forEach(pred => {
          const [x, y, width, height] = pred.bbox;
          const mirroredX = videoWidth - x - width;
          formattedPreds.push({
            label: pred.class, confidence: pred.score, type: 'object',
            style: {
              left: `${offsetX + (mirroredX * scaleXFactor)}px`,
              top: `${offsetY + (y * scaleYFactor)}px`,
              width: `${width * scaleXFactor}px`, height: `${height * scaleYFactor}px`,
            }
          });
          emitVisionAlert(pred.class, pred.score);
        });

        facePreds.forEach(pred => {
          const box = pred.detection.box;
          const expressions = pred.expressions;
          const maxValue = Math.max(...Object.values(expressions));
          const emotion = Object.keys(expressions).find(key => expressions[key] === maxValue);
          const mirroredX = videoWidth - box.x - box.width;

          formattedPreds.push({
            label: `${emotion}`, confidence: maxValue, type: 'emotion',
            style: {
              left: `${offsetX + (mirroredX * scaleXFactor)}px`,
              top: `${offsetY + (box.y * scaleYFactor)}px`,
              width: `${box.width * scaleXFactor}px`, height: `${box.height * scaleYFactor}px`,
            }
          });
          emitVisionAlert(emotion, maxValue);
        });

        setPredictions(formattedPreds);
      }
      animationRef.current = requestAnimationFrame(detectFrame);
    };

    detectFrame();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [cocoModel, faceModelsLoaded, cameraActive, alertsEnabled]);

  const boundingBoxColors = { object: '#3b82f6', emotion: '#8b5cf6' };

  return (
    <div className="space-y-6">
      {/* Responsive Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Vision Pipeline</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Real-time Deep Learning Object Detection + Emotion Analysis</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center w-full md:w-auto justify-start md:justify-end">
          <Badge variant={isModelLoading ? "warning" : "success"} className="animate-pulse">
            {isModelLoading ? "Loading Models..." : "TF.js Models Active"}
          </Badge>

          {/* Alert Toggle */}
          <Button
            variant={alertsEnabled ? "outline" : "ghost"}
            size="sm"
            onClick={() => setAlertsEnabled(!alertsEnabled)}
            className={alertsEnabled ? "border-ai-orange/50 text-ai-orange" : "text-gray-500"}
          >
            {alertsEnabled ? <Bell className="h-4 w-4 mr-2" /> : <BellOff className="h-4 w-4 mr-2" />}
            <span className="hidden sm:inline">{alertsEnabled ? "Alerts On" : "Alerts Off"}</span>
          </Button>
          
          {cameraActive ? (
            <Button variant="destructive" size="sm" onClick={stopCamera}>
              <VideoOff className="h-4 w-4 mr-2" /> Stop Camera
            </Button>
          ) : (
            <Button variant="ai" size="sm" onClick={startCamera} disabled={isModelLoading}>
              <Video className="h-4 w-4 mr-2" /> Start Live Detection
            </Button>
          )}
        </div>
      </div>

      {/* Responsive Grid Layout */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Main Vision Feed - aspect-video for responsive scaling */}
        <div className="lg:col-span-2">
          <Card className="bg-black border-gray-800 overflow-hidden relative aspect-video w-full">
            <div ref={containerRef} className="absolute inset-0 flex items-center justify-center">
              <video ref={videoRef} autoPlay playsInline muted className="max-w-full max-h-full" style={{ transform: 'scaleX(-1)' }} />
            </div>
            
            {!cameraActive && (
              <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-gray-600 z-30">
                {isModelLoading ? <Loader2 className="h-16 w-16 mb-4 animate-spin text-ai-blue" /> : <Camera className="h-16 w-16 mb-4" />}
                <p className="text-lg font-bold text-gray-400">
                  {isModelLoading ? "Downloading AI Model Weights..." : "Camera Offline"}
                </p>
              </div>
            )}

            {/* Bounding Boxes */}
            {predictions.map((pred, idx) => {
              const color = pred.type === 'emotion' ? boundingBoxColors.emotion : boundingBoxColors.object;
              return (
                <div key={idx} className="absolute border-2 rounded-md pointer-events-none z-10"
                  style={{ ...pred.style, borderColor: color, boxShadow: `0 0 12px ${color}44`, transition: 'all 0.1s ease-out' }}>
                  <div className="absolute -top-5 left-0 px-1.5 py-0.5 text-[10px] font-bold text-white rounded-sm"
                    style={{ backgroundColor: color }}>
                    {pred.type === 'emotion' && <Smile className="h-2.5 w-2.5 inline mr-1" />}
                    {pred.label} {(pred.confidence * 100).toFixed(0)}%
                  </div>
                </div>
              );
            })}

            {/* Tactical overlay */}
            <div className="absolute inset-4 border border-gray-700/50 rounded-xl pointer-events-none z-20">
              <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-ai-blue/50 rounded-tl-xl"></div>
              <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-ai-blue/50 rounded-tr-xl"></div>
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-ai-blue/50 rounded-bl-xl"></div>
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-ai-blue/50 rounded-br-xl"></div>
            </div>
          </Card>
        </div>

        {/* Model Stats & Detections */}
        <div className="space-y-4 lg:col-span-1">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Cpu className="h-4 w-4 text-ai-cyan" /> Model Stats</CardTitle></CardHeader>
            <CardContent className="space-y-4 font-mono text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Engine</span><span className="text-ai-blue">TF.js WebGL</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Object Model</span><span className="text-ai-purple">COCO-SSD</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Emotion Model</span><span className="text-ai-cyan">Face-API</span></div>
              <div className="h-px bg-border" />
              <div className="flex justify-between"><span className="text-muted-foreground">Inference Time</span><span className="text-ai-green">{inferenceTime}ms</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Live FPS</span><span className="text-ai-orange">{inferenceTime > 0 ? Math.round(1000 / inferenceTime) : 0}</span></div>
              <div className="h-px bg-border" />
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Jarvis Alerts</span>
                <Badge variant={alertsEnabled ? "success" : "secondary"} className="text-[10px]">
                  {alertsEnabled ? "ACTIVE" : "MUTED"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Scan className="h-4 w-4 text-ai-purple" /> Detections</CardTitle></CardHeader>
            <CardContent className="space-y-2 max-h-[200px] overflow-y-auto">
              {predictions.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4">
                  {cameraActive ? "Scanning for objects..." : "Start camera to detect"}
                </div>
              ) : (
                predictions.map((pred, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs border-b border-border pb-1">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${pred.type === 'emotion' ? 'bg-ai-purple' : 'bg-ai-blue'}`} />
                      <span className="font-medium">{pred.label}</span>
                    </div>
                    <span className="font-mono text-muted-foreground">{(pred.confidence * 100).toFixed(0)}%</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}