// components/AudioRecorder.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Pause, Play, Trash2, Save, Settings, AlertCircle } from 'lucide-react';

interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob, filename: string) => void;
  onCancel?: () => void;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ onRecordingComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; type: 'denied' | 'other' } | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Check for supported mime types
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setError(null);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Error accessing microphone:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError({ 
          message: 'Microphone access is blocked.', 
          type: 'denied' 
        });
      } else {
        setError({ 
          message: 'Could not access microphone. Please ensure it is plugged in.', 
          type: 'other' 
        });
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const togglePause = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
      } else {
        mediaRecorderRef.current.pause();
        if (timerRef.current) clearInterval(timerRef.current);
      }
      setIsPaused(!isPaused);
    }
  };

  const deleteRecording = () => {
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setRecordingTime(0);
  };

  const saveRecording = () => {
    if (audioBlob) {
      const timestamp = Date.now();
      const filename = `recording_${timestamp}.webm`;
      onRecordingComplete(audioBlob, filename);
      deleteRecording();
    }
  };

  const formatTime = (s: number): string => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  return (
    <div className="border rounded-lg p-3 bg-gradient-to-br from-slate-50 to-gray-100 shadow-sm min-w-[300px]">
      <div className="space-y-3">
        
        {/* Error Handling UI */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800">{error.message}</p>
                {error.type === 'denied' && (
                  <p className="text-xs text-red-600 mt-1">
                    Click the <strong>lock icon</strong> in your browser address bar to allow microphone access, then try again.
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={startRecording}
              className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors text-xs font-medium"
            >
              <Settings className="w-3 h-3" />
              Try Again / Grant Access
            </button>
          </div>
        )}

        {/* Recording UI */}
        {!audioBlob && !error && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${
                  isRecording && !isPaused ? 'bg-red-500 animate-pulse' : 'bg-gray-400'
                }`} />
                <span className="text-lg font-mono font-bold text-gray-800">
                  {formatTime(recordingTime)}
                </span>
              </div>
              {isRecording && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                  {isPaused ? 'PAUSED' : 'LIVE'}
                </span>
              )}
            </div>

            <div className="flex gap-2">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all active:scale-95 text-sm font-bold shadow-md shadow-red-200"
                >
                  <Mic className="w-5 h-5" />
                  Start Recording
                </button>
              ) : (
                <>
                  <button
                    onClick={togglePause}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    {isPaused ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    onClick={stopRecording}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    <Square className="w-4 h-4" />
                    Stop
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Preview & Save UI */}
        {audioBlob && audioUrl && (
          <div className="space-y-3">
            <div className="bg-white rounded-xl p-2 border shadow-inner">
              <audio
                ref={audioPreviewRef}
                src={audioUrl}
                className="w-full"
                controls
                style={{ height: '36px' }}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={deleteRecording}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border-2 border-red-100 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
              >
                <Trash2 className="w-4 h-4" />
                Discard
              </button>
              <button
                onClick={saveRecording}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all active:scale-95 text-sm font-bold shadow-md shadow-emerald-100"
              >
                <Save className="w-4 h-4" />
                Save Recording
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioRecorder;