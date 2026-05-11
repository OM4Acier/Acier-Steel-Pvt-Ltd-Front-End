// components/AudioPlayer.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Trash2, Volume2 } from 'lucide-react';
import { fileApi } from '@/lib/api/fileApi';
import { toast } from 'sonner';

interface AudioFile {
  fileId: string;
  filename: string;
  _id: string;
}

interface AudioPlayerProps {
  file: AudioFile;
  onDelete?: (file: AudioFile) => void;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ file, onDelete }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [shouldAutoPlay, setShouldAutoPlay] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const hasAttemptedLoadRef = useRef(false);

  // Load audio
  const loadAudio = async () => {
    if (audioSrc || hasAttemptedLoadRef.current) return;

    hasAttemptedLoadRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const mediaUrl = fileApi.getMediaUrl(file.fileId, file.filename);
      setAudioSrc(mediaUrl);
    } catch (err: any) {
      setError('Load failed');
      toast.error(`Failed to fetch orders: ${err.message}`);
      setIsLoading(false);
      hasAttemptedLoadRef.current = false;
    }
  };

  // Auto-play when ready
  useEffect(() => {
    if (isAudioReady && shouldAutoPlay && audioRef.current) {
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
          setShouldAutoPlay(false);
        })
        .catch(() => {
          setShouldAutoPlay(false);
        });
    }
  }, [isAudioReady, shouldAutoPlay]);

  // Toggle play/pause
  const togglePlayPause = async () => {
    if (!audioRef.current || !isAudioReady) {
      setShouldAutoPlay(true);
      loadAudio();
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (err) {
        setError('Play failed');
        toast.error(`Failed to fetch orders: ${err}`);
        setTimeout(() => setError(null), 2000);
      }
    }
  };

  // Event handlers
  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const d = audioRef.current.duration;
      if (isFinite(d) && d > 0) setDuration(d);
    }
  };

  const handleCanPlay = () => {
    setIsAudioReady(true);
    setIsLoading(false);
    if (audioRef.current) {
      const d = audioRef.current.duration;
      if (isFinite(d) && d > 0) setDuration(d);
    }
  };

  const handleCanPlayThrough = () => {
    setIsAudioReady(true);
    setIsLoading(false);
  };

  const handleDurationChange = () => {
    if (audioRef.current) {
      const d = audioRef.current.duration;
      if (isFinite(d) && d > 0) setDuration(d);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) audioRef.current.currentTime = 0;
  };

  const handleError = () => {
    setError('Load failed');
    setIsLoading(false);
    setIsAudioReady(false);
    hasAttemptedLoadRef.current = false;
    setShouldAutoPlay(false);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration || !isAudioReady) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;

    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (s: number): string => {
    if (isNaN(s) || s === Infinity || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  return (
    <div className="border rounded-lg p-2 bg-white hover:shadow-sm transition-all">
      {audioSrc && (
        <audio
          ref={audioRef}
          src={audioSrc}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onCanPlay={handleCanPlay}
          onCanPlayThrough={handleCanPlayThrough}
          onDurationChange={handleDurationChange}
          onEnded={handleEnded}
          onError={handleError}
          preload="metadata"
        />
      )}

      <div className="space-y-1">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <Volume2 className="w-3 h-3 text-blue-600 flex-shrink-0" />
            <span className="text-xs font-medium text-gray-800 truncate">
              {file.filename}
            </span>
            {isLoading && (
              <span className="text-xs text-blue-600 animate-pulse">•</span>
            )}
          </div>
          {onDelete && (
            <button
              onClick={() => onDelete(file)}
              className="p-1 hover:bg-red-50 rounded transition-colors group"
              title="Delete"
            >
              <Trash2 className="w-3 h-3 text-gray-400 group-hover:text-red-600" />
            </button>
          )}
        </div>

        {error && (
          <div className="text-xs text-red-600 bg-red-50 px-1 py-0.5 rounded">
            {error}
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Play Button */}
          <button
            onClick={togglePlayPause}
            className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors flex-shrink-0"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isLoading && !isAudioReady ? (
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-3 h-3" />
            ) : (
              <Play className="w-3 h-3 ml-0.5" />
            )}
          </button>

          {/* Progress */}
          <div className="flex-1 space-y-0.5">
            <div
              className={`h-1.5 bg-gray-200 rounded-full overflow-hidden ${
                isAudioReady && duration > 0 ? 'cursor-pointer' : 'cursor-not-allowed'
              }`}
              onClick={handleProgressClick}
            >
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-100"
                style={{
                  width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`
                }}
              />
            </div>

            {/* Time */}
            <div className="flex justify-between text-xs text-gray-500">
              <span>{formatTime(currentTime)}</span>
              <span>{duration > 0 ? formatTime(duration) : '--:--'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer;