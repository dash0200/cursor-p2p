import { useState, useRef, useEffect } from 'react';

export const useVideoPlayer = (sendMessage, addLog) => {
  const [videoFile, setVideoFile] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isVideoMuted, setIsVideoMuted] = useState(false);

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);

  const formatTime = (time) => {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  };

  const handleVideoFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
      const videoUrl = URL.createObjectURL(file);
      if (videoRef.current) {
        videoRef.current.src = videoUrl;
        videoRef.current.onloadeddata = () => {
          videoRef.current.play().then(() => {
            setIsPlaying(true);
            sendMessage({ type: 'video-play', time: 0 });
            addLog(`Played by you at ${formatTime(0)}`);
          }).catch((error) => {
            console.log('Autoplay prevented:', error);
            addLog('Autoplay prevented - user interaction may be required');
          });
        };
      }
      sendMessage({
        type: 'video-file',
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      });
      addLog(`Selected video: ${file.name} (${Math.round(file.size / 1024 / 1024 * 100) / 100} MB) and notified peer`);
    }
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
        const pauseMessage = { type: 'video-pause', time: currentTime };
        sendMessage(pauseMessage);
        addLog(`Paused by you at ${formatTime(currentTime)}`);
      } else {
        videoRef.current.play().then(() => {
          setIsPlaying(true);
          const playMessage = { type: 'video-play', time: currentTime };
          sendMessage(playMessage);
          addLog(`Played by you at ${formatTime(currentTime)}`);
        }).catch((error) => {
          console.log('Play failed:', error);
          addLog('Play failed - may need user interaction');
        });
      }
    }
  };

  const handleSeek = (e) => {
    if (videoRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const clientX = e.clientX || (e.touches && e.touches[0]?.clientX);
      const clickX = clientX - rect.left;
      const width = rect.width;
      const newTime = (clickX / width) * duration;
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      sendMessage({ type: 'video-seek', time: newTime });
      addLog(`Seeked by you to ${formatTime(newTime)}`);
    }
  };

  const handleVolumeChange = (e) => {
    if (videoRef.current) {
      const newVolume = parseFloat(e.target.value);
      setVolume(newVolume);
      videoRef.current.volume = newVolume;
      setIsVideoMuted(newVolume === 0);
    }
  };

  const toggleVideoMute = () => {
    if (videoRef.current) {
      if (isVideoMuted) {
        videoRef.current.volume = volume;
        setIsVideoMuted(false);
      } else {
        videoRef.current.volume = 0;
        setIsVideoMuted(true);
      }
    }
  };

  const toggleFullscreen = () => {
    if (!videoRef.current) return;

    if (!document.fullscreenElement) {
      videoRef.current.requestFullscreen().catch(err => {
        console.log('Error attempting to enable fullscreen:', err);
        addLog('Fullscreen not supported or blocked');
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handleKeyPress = (e) => {
    if (!videoRef.current || !videoFile) return;

    const video = videoRef.current;

    switch (e.key) {
      case ' ':
        e.preventDefault();
        togglePlayPause();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        const seekLeftTime = Math.max(0, video.currentTime - 10);
        video.currentTime = seekLeftTime;
        setCurrentTime(seekLeftTime);
        sendMessage({ type: 'video-seek', time: seekLeftTime });
        addLog(`Seeked by you to ${formatTime(seekLeftTime)}`);
        break;
      case 'ArrowRight':
        e.preventDefault();
        const seekRightTime = Math.min(video.duration, video.currentTime + 10);
        video.currentTime = seekRightTime;
        setCurrentTime(seekRightTime);
        sendMessage({ type: 'video-seek', time: seekRightTime });
        addLog(`Seeked by you to ${formatTime(seekRightTime)}`);
        break;
      case 'ArrowUp':
        e.preventDefault();
        const newVolumeUp = Math.min(1, video.volume + 0.1);
        video.volume = newVolumeUp;
        setVolume(newVolumeUp);
        setIsVideoMuted(newVolumeUp === 0);
        break;
      case 'ArrowDown':
        e.preventDefault();
        const newVolumeDown = Math.max(0, video.volume - 0.1);
        video.volume = newVolumeDown;
        setVolume(newVolumeDown);
        setIsVideoMuted(newVolumeDown === 0);
        break;
      case 'm':
      case 'M':
        e.preventDefault();
        toggleVideoMute();
        break;
      case 'f':
      case 'F':
        e.preventDefault();
        toggleFullscreen();
        break;
      case 'Escape':
        if (document.fullscreenElement) {
          document.exitFullscreen();
        }
        break;
    }
  };

  // Add keyboard event listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [videoFile, isPlaying, currentTime, volume, isVideoMuted]);

  // Add event listeners for video state changes
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      const handlePlay = () => setIsPlaying(true);
      const handlePause = () => setIsPlaying(false);
      const handleEnded = () => setIsPlaying(false);
      const handleTimeUpdate = () => setCurrentTime(video.currentTime);
      const handleLoadedMetadata = () => setDuration(video.duration);
      const handleVolumeChange = () => {
        setVolume(video.volume);
        setIsVideoMuted(video.muted);
      };

      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);
      video.addEventListener('ended', handleEnded);
      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('volumechange', handleVolumeChange);

      return () => {
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
        video.removeEventListener('ended', handleEnded);
        video.removeEventListener('timeupdate', handleTimeUpdate);
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('volumechange', handleVolumeChange);
      };
    }
  }, [videoFile]);

  return {
    // State
    videoFile,
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    duration,
    volume,
    isVideoMuted,
    
    // Refs
    videoRef,
    fileInputRef,
    
    // Functions
    handleVideoFileSelect,
    togglePlayPause,
    handleSeek,
    handleVolumeChange,
    toggleVideoMute,
    toggleFullscreen,
    formatTime
  };
};
