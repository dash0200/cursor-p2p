import { useState, useRef, useEffect, useCallback } from 'react';
import { extractYouTubeVideoId, isValidYouTubeUrl, getYouTubeEmbedUrl } from '../utils/videoUtils';
import YouTubePlayerManager from '../utils/youtubePlayer';

export const useVideoPlayer = (sendMessage, addLog) => {
  const addLogRef = useRef(addLog);
  addLogRef.current = addLog;
  
  const sendMessageRef = useRef(sendMessage);
  sendMessageRef.current = sendMessage;
  
  const memoizedAddLog = useCallback((message) => {
    addLogRef.current(message);
  }, []);
  
  const memoizedSendMessage = useCallback((message) => {
    sendMessageRef.current(message);
  }, []);

  // Comprehensive cleanup function for switching between video types
  const clearAllVideoStates = useCallback((preserveYouTube = false) => {
    memoizedAddLog('Clearing all video states for seamless switching...');
    
    // Clear all video states
    setVideoFile(null);
    if (!preserveYouTube) {
      setYoutubeUrl('');
      setYoutubeVideoId(null);
    }
    setYoutubePlayer(null);
    setDirectVideoUrl('');
    setDirectVideoLoaded(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setPendingCommands([]);
    setIsLoadingVideo(false);
    
    // Clear input states
    setYoutubeInputUrl('');
    setDirectVideoInputUrl('');
    
    // Clean up video element
    if (videoRef.current) {
      videoRef.current.src = '';
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    
    // Clean up YouTube player
    if (youtubePlayerManagerRef.current) {
      try {
        youtubePlayerManagerRef.current.destroy();
      } catch (error) {
        memoizedAddLog(`Error destroying YouTube player: ${error.message}`);
      }
      youtubePlayerManagerRef.current = null;
    }
    
    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [memoizedAddLog]);
  const [videoFile, setVideoFile] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeVideoId, setYoutubeVideoId] = useState(null);
  const [youtubePlayer, setYoutubePlayer] = useState(null);
  const [directVideoUrl, setDirectVideoUrl] = useState('');
  const [youtubeInputUrl, setYoutubeInputUrl] = useState('');
  const [directVideoInputUrl, setDirectVideoInputUrl] = useState('');
  const [directVideoLoaded, setDirectVideoLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [pendingCommands, setPendingCommands] = useState([]);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const youtubeIframeRef = useRef(null);
  const youtubePlayerManagerRef = useRef(null);
  
  // Refs for current values to avoid dependency issues
  const currentTimeRef = useRef(0);
  const isPlayingRef = useRef(false);
  const volumeRef = useRef(1);
  const isVideoMutedRef = useRef(false);
  const youtubeVideoIdRef = useRef(null);
  const videoFileRef = useRef(null);
  const pendingCommandsRef = useRef([]);
  const isPlayerReadyRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    isVideoMutedRef.current = isVideoMuted;
  }, [isVideoMuted]);

  useEffect(() => {
    youtubeVideoIdRef.current = youtubeVideoId;
  }, [youtubeVideoId]);

  useEffect(() => {
    videoFileRef.current = videoFile;
  }, [videoFile]);

  useEffect(() => {
    pendingCommandsRef.current = pendingCommands;
  }, [pendingCommands]);

  // Execute pending commands when player is ready
  const executePendingCommands = useCallback(() => {
    if (pendingCommandsRef.current.length > 0 && youtubePlayerManagerRef.current?.isReady) {
      memoizedAddLog(`Executing ${pendingCommandsRef.current.length} pending commands`);
      const commandsToExecute = [...pendingCommandsRef.current]; // Create a copy
      setPendingCommands([]); // Clear immediately to prevent re-execution
      
      commandsToExecute.forEach(command => {
        if (command.type === 'play') {
          youtubePlayerManagerRef.current.playVideo();
          setIsPlaying(true);
        } else if (command.type === 'pause') {
          youtubePlayerManagerRef.current.pauseVideo();
          setIsPlaying(false);
        } else if (command.type === 'seek' && command.time !== undefined) {
          youtubePlayerManagerRef.current.seekTo(command.time, true);
          setCurrentTime(command.time);
        }
      });
    }
  }, [memoizedAddLog]);

  // Add command to pending queue
  const addPendingCommand = (command) => {
    setPendingCommands(prev => [...prev, command]);
  };

  const formatTime = useCallback((time) => {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  }, []);

  const handleVideoFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('video/')) {
      // Clear all video states for seamless switching
      clearAllVideoStates();
      
      setVideoFile(file);
      const videoUrl = URL.createObjectURL(file);
      if (videoRef.current) {
        videoRef.current.src = videoUrl;
        videoRef.current.onloadeddata = () => {
          setDuration(videoRef.current.duration);
          videoRef.current.play().then(() => {
            setIsPlaying(true);
            memoizedSendMessage({ type: 'video-play', time: 0 });
            memoizedAddLog(`Local video played by you at ${formatTime(0)}`);
          }).catch((error) => {
            console.log('Autoplay prevented:', error);
            memoizedAddLog('Autoplay prevented - user interaction may be required');
          });
        };
      }
      memoizedSendMessage({
        type: 'video-file',
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      });
      memoizedAddLog(`Selected local video: ${file.name} (${Math.round(file.size / 1024 / 1024 * 100) / 100} MB) and notified peer`);
    }
  };

  const handleYoutubeUrlChange = (event) => {
    setYoutubeInputUrl(event.target.value);
  };

  const loadYouTubeVideo = useCallback(async (videoId, url, isFromPeer = false, forceReload = false) => {
    if (!videoId) {
      memoizedAddLog('Invalid YouTube video ID');
      return;
    }

    if (isLoadingVideo) {
      memoizedAddLog('Already loading a video, please wait...');
      return;
    }

    // If it's the same video and not forced to reload, skip
    if (!forceReload && youtubeVideoId === videoId && youtubePlayerManagerRef.current?.isReady) {
      memoizedAddLog(`Same video already loaded (${videoId}), skipping...`);
      return;
    }

    memoizedAddLog(`Loading video: ${videoId}, forceReload: ${forceReload}, currentVideo: ${youtubeVideoId}`);

    setIsLoadingVideo(true);

    // Clear all video states for seamless switching, but preserve YouTube URL for peer notification
    clearAllVideoStates(true);

    setYoutubeVideoId(videoId);
    if (url) {
      setYoutubeUrl(url);
    }
    memoizedAddLog(`Loading YouTube video: ${videoId}`);
    
    // Wait a bit for cleanup to complete
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Force iframe reload if it exists
    if (youtubeIframeRef.current) {
      const newEmbedUrl = getYouTubeEmbedUrl(videoId);
      memoizedAddLog(`Updating iframe src to: ${newEmbedUrl}`);
      youtubeIframeRef.current.src = newEmbedUrl;
    }
    
    // Initialize YouTube player
    try {
      const playerManager = new YouTubePlayerManager();
      
      // Set up callbacks
      playerManager.setOnReady((event) => {
        memoizedAddLog('YouTube player ready');
        setYoutubePlayer(playerManager);
        setDuration(playerManager.getDuration());
        
        // Execute any pending commands
        setTimeout(() => {
          executePendingCommands();
        }, 100);
        
        // If this is from a peer, we might need to sync the current state
        if (isFromPeer) {
          // Small delay to ensure player is fully ready
          setTimeout(() => {
            memoizedAddLog('YouTube player fully initialized and ready for sync');
          }, 500);
        }
      });

      // Set up state change handler for UI updates only
      playerManager.setOnStateChange((event) => {
        const state = event.data;
        if (state === 1) { // Playing
          setIsPlaying(true);
        } else if (state === 2) { // Paused
          setIsPlaying(false);
        }
      });

      playerManager.setOnTimeUpdate((time) => {
        setCurrentTime(time);
      });

      // Wait for YouTube API to be ready
      const waitForYouTubeAPI = () => {
        return new Promise((resolve) => {
          if (typeof YT !== 'undefined' && YT.Player) {
            resolve();
          } else {
            setTimeout(() => waitForYouTubeAPI().then(resolve), 100);
          }
        });
      };

      await waitForYouTubeAPI();
      
      // Use the iframe ref for the player
      if (youtubeIframeRef.current) {
        const containerId = youtubeIframeRef.current.id || 'youtube-player-iframe';
        youtubeIframeRef.current.id = containerId;
        await playerManager.initializePlayer(containerId, videoId);
        youtubePlayerManagerRef.current = playerManager;
      } else {
        // If iframe ref is not available, wait a bit and try again
        await new Promise(resolve => setTimeout(resolve, 500));
        if (youtubeIframeRef.current) {
          const containerId = youtubeIframeRef.current.id || 'youtube-player-iframe';
          youtubeIframeRef.current.id = containerId;
          await playerManager.initializePlayer(containerId, videoId);
          youtubePlayerManagerRef.current = playerManager;
        } else {
          throw new Error('YouTube iframe ref not available after retry');
        }
      }
      
      // Send YouTube video info to peer only if not from peer
      if (!isFromPeer) {
        const videoUrl = url || youtubeUrl || `https://www.youtube.com/watch?v=${videoId}`;
        memoizedSendMessage({
          type: 'youtube-video',
          videoId: videoId,
          url: videoUrl,
          timestamp: Date.now() // Add timestamp to force peer to reload
        });
        memoizedAddLog(`YouTube video loaded and notified peer with URL: ${videoUrl}`);
      } else {
        memoizedAddLog(`YouTube video loaded from peer`);
      }
      
    } catch (error) {
      console.error('Error initializing YouTube player:', error);
      memoizedAddLog('Error loading YouTube video');
    } finally {
      setIsLoadingVideo(false);
    }
  }, [memoizedAddLog, memoizedSendMessage, formatTime]);

  const handleYoutubeSubmit = async (onHideInput) => {
    if (!youtubeInputUrl.trim()) return;
    
    const videoId = extractYouTubeVideoId(youtubeInputUrl);
    if (!videoId) {
      memoizedAddLog('Invalid YouTube URL');
      return;
    }

    // Clear the input immediately when button is clicked
    setYoutubeInputUrl('');
    
    // Hide the input box immediately
    if (onHideInput) {
      onHideInput();
    }
    
    await loadYouTubeVideo(videoId, youtubeInputUrl, false);
  };

  const handleDirectVideoUrlChange = (event) => {
    setDirectVideoInputUrl(event.target.value);
  };

  const handleDirectVideoSubmit = async (onHideInput) => {
    if (!directVideoInputUrl.trim()) return;
    
    const url = directVideoInputUrl.trim();
    
    // Basic URL validation
    try {
      new URL(url);
    } catch (error) {
      memoizedAddLog('Invalid URL format. Please enter a valid URL.');
      return;
    }
    
    // Check if URL looks like a video file
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.flv', '.wmv'];
    const hasVideoExtension = videoExtensions.some(ext => url.toLowerCase().includes(ext));
    
    if (!hasVideoExtension) {
      memoizedAddLog('Warning: URL does not appear to be a direct video file link.');
      memoizedAddLog('Supported formats: .mp4, .webm, .ogg, .mov, .avi, .mkv, .flv, .wmv');
    }
    
    memoizedAddLog(`Loading direct video: ${url}`);
    
    // Clear the input immediately when button is clicked
    setDirectVideoInputUrl('');
    
    // Hide the input box immediately
    if (onHideInput) {
      onHideInput();
    }
    
    // Clear all video states for seamless switching
    clearAllVideoStates();
    
    // Set the direct video URL
    setDirectVideoUrl(url);
    
    if (videoRef.current) {
      videoRef.current.src = url;
      videoRef.current.onloadeddata = () => {
        setDirectVideoLoaded(true);
        setDuration(videoRef.current.duration);
        memoizedAddLog(`Direct video loaded successfully (${formatTime(videoRef.current.duration)})`);
        videoRef.current.play().then(() => {
          setIsPlaying(true);
          memoizedSendMessage({ type: 'video-play', time: 0 });
          memoizedAddLog(`Direct video played by you at ${formatTime(0)}`);
        }).catch((error) => {
          console.log('Autoplay prevented:', error);
          memoizedAddLog('Autoplay prevented - user interaction may be required');
        });
      };
      
      videoRef.current.onerror = (error) => {
        memoizedAddLog(`Error loading direct video: ${error.message || 'Unknown error'}`);
        memoizedAddLog('Possible issues:');
        memoizedAddLog('- URL is not a direct link to a video file');
        memoizedAddLog('- Video format is not supported by your browser');
        memoizedAddLog('- Server does not allow cross-origin requests (CORS)');
        memoizedAddLog('- Network connectivity issues');
        setDirectVideoLoaded(false);
      };
      
      videoRef.current.onloadstart = () => {
        memoizedAddLog('Starting to load direct video...');
      };
      
      videoRef.current.oncanplay = () => {
        memoizedAddLog('Direct video can start playing');
      };
    }
    
    // Notify peer about the direct video
    memoizedSendMessage({
      type: 'direct-video',
      url: url
    });
    memoizedAddLog(`Direct video loaded and notified peer`);
  };

  const togglePlayPause = useCallback(() => {
    if (youtubePlayerManagerRef.current && youtubeVideoId && youtubePlayerManagerRef.current.isReady) {
      // Handle YouTube video
      if (isPlaying) {
        youtubePlayerManagerRef.current.pauseVideo();
        setIsPlaying(false);
        const pauseMessage = { type: 'youtube-pause', time: currentTime };
        memoizedSendMessage(pauseMessage);
        memoizedAddLog(`YouTube paused by you at ${formatTime(currentTime)}`);
      } else {
        youtubePlayerManagerRef.current.playVideo();
        setIsPlaying(true);
        const playMessage = { type: 'youtube-play', time: currentTime };
        memoizedSendMessage(playMessage);
        memoizedAddLog(`YouTube played by you at ${formatTime(currentTime)}`);
      }
    } else if (videoRef.current && (videoFile || directVideoUrl)) {
      // Handle local video file or direct video URL
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
        const pauseMessage = { type: 'video-pause', time: currentTime };
        memoizedSendMessage(pauseMessage);
        memoizedAddLog(`Paused by you at ${formatTime(currentTime)}`);
      } else {
        videoRef.current.play().then(() => {
          setIsPlaying(true);
          const playMessage = { type: 'video-play', time: currentTime };
          memoizedSendMessage(playMessage);
          memoizedAddLog(`Played by you at ${formatTime(currentTime)}`);
        }).catch((error) => {
          console.log('Play failed:', error);
          memoizedAddLog('Play failed - may need user interaction');
        });
      }
    } else if (youtubeVideoId && !youtubePlayerManagerRef.current) {
      memoizedAddLog('YouTube player not initialized yet, please wait...');
    } else if (youtubePlayerManagerRef.current && youtubeVideoId && !youtubePlayerManagerRef.current.isReady) {
      memoizedAddLog('YouTube player not ready yet, please wait...');
    } else {
      memoizedAddLog('No video loaded or player not available');
    }
  }, [youtubeVideoId, videoFile, directVideoUrl, isPlaying, currentTime, memoizedSendMessage, memoizedAddLog, formatTime]);

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX);
    const clickX = clientX - rect.left;
    const width = rect.width;
    const newTime = (clickX / width) * duration;
    
    if (youtubePlayerManagerRef.current && youtubeVideoId && youtubePlayerManagerRef.current.isReady) {
      // Handle YouTube video seek
      youtubePlayerManagerRef.current.seekTo(newTime, true);
      setCurrentTime(newTime);
      memoizedSendMessage({ type: 'youtube-seek', time: newTime });
      addLog(`YouTube seeked by you to ${formatTime(newTime)}`);
    } else if (videoRef.current && (videoFile || directVideoUrl)) {
      // Handle local video file or direct video URL seek
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      memoizedSendMessage({ type: 'video-seek', time: newTime });
      addLog(`Seeked by you to ${formatTime(newTime)}`);
    } else if (youtubePlayerManagerRef.current && youtubeVideoId && !youtubePlayerManagerRef.current.isReady) {
      addLog('YouTube player not ready yet, please wait...');
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

  const toggleVideoMute = useCallback(() => {
    if (videoRef.current) {
      if (isVideoMutedRef.current) {
        videoRef.current.volume = volumeRef.current;
        setIsVideoMuted(false);
      } else {
        videoRef.current.volume = 0;
        setIsVideoMuted(true);
      }
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!videoRef.current) return;

    if (!document.fullscreenElement) {
      videoRef.current.requestFullscreen().catch(err => {
        console.log('Error attempting to enable fullscreen:', err);
        memoizedAddLog('Fullscreen not supported or blocked');
      });
    } else {
      document.exitFullscreen();
    }
  }, [memoizedAddLog]);

  const handleKeyPress = useCallback((e) => {
    // Don't handle keyboard events if user is typing in an input field
    const activeElement = document.activeElement;
    const isTyping = activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.contentEditable === 'true'
    );
    
    if (isTyping) {
      return; // Let the input handle the key press
    }

    // Handle YouTube video keyboard controls
    if (youtubeVideoIdRef.current && youtubePlayerManagerRef.current?.isReady) {
      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          const currentTime = youtubePlayerManagerRef.current.getCurrentTime();
          const seekLeftTime = Math.max(0, currentTime - 10);
          youtubePlayerManagerRef.current.seekTo(seekLeftTime, true);
          setCurrentTime(seekLeftTime);
          memoizedSendMessage({ type: 'youtube-seek', time: seekLeftTime });
          memoizedAddLog(`YouTube seeked by you to ${formatTime(seekLeftTime)}`);
          break;
        case 'ArrowRight':
          e.preventDefault();
          const currentTimeRight = youtubePlayerManagerRef.current.getCurrentTime();
          const duration = youtubePlayerManagerRef.current.getDuration();
          const seekRightTime = Math.min(duration, currentTimeRight + 10);
          youtubePlayerManagerRef.current.seekTo(seekRightTime, true);
          setCurrentTime(seekRightTime);
          memoizedSendMessage({ type: 'youtube-seek', time: seekRightTime });
          memoizedAddLog(`YouTube seeked by you to ${formatTime(seekRightTime)}`);
          break;
        case 'ArrowUp':
          e.preventDefault();
          // YouTube doesn't support volume control via API, so we'll skip this
          memoizedAddLog('Volume control not available for YouTube videos');
          break;
        case 'ArrowDown':
          e.preventDefault();
          // YouTube doesn't support volume control via API, so we'll skip this
          memoizedAddLog('Volume control not available for YouTube videos');
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          // YouTube doesn't support mute control via API, so we'll skip this
          memoizedAddLog('Mute control not available for YouTube videos');
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
      return;
    }

    // Handle local video file or direct video URL keyboard controls
    if (!videoRef.current || (!videoFileRef.current && !directVideoUrl)) return;

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
        memoizedSendMessage({ type: 'video-seek', time: seekLeftTime });
        memoizedAddLog(`Seeked by you to ${formatTime(seekLeftTime)}`);
        break;
      case 'ArrowRight':
        e.preventDefault();
        const seekRightTime = Math.min(video.duration, video.currentTime + 10);
        video.currentTime = seekRightTime;
        setCurrentTime(seekRightTime);
        memoizedSendMessage({ type: 'video-seek', time: seekRightTime });
        memoizedAddLog(`Seeked by you to ${formatTime(seekRightTime)}`);
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
  }, [togglePlayPause, memoizedSendMessage, memoizedAddLog, formatTime, toggleFullscreen, toggleVideoMute]);

  // Add keyboard event listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleKeyPress]);

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
  }, [videoFile, directVideoUrl]);

  // Execute pending commands when player becomes ready - handled in YouTube player ready callback

  // Ensure YouTube player is properly initialized when video ID changes
  useEffect(() => {
    if (youtubeVideoId && youtubeIframeRef.current && !youtubePlayerManagerRef.current) {
      // Small delay to ensure iframe is fully rendered
      const timer = setTimeout(() => {
        if (youtubeIframeRef.current && !youtubePlayerManagerRef.current) {
          memoizedAddLog('Re-initializing YouTube player for peer...');
          loadYouTubeVideo(youtubeVideoId, youtubeUrl, true, true);
        }
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [youtubeVideoId, youtubeUrl]);

  // Force re-initialization when iframe is recreated
  useEffect(() => {
    if (youtubeVideoId && youtubeIframeRef.current && !youtubePlayerManagerRef.current) {
      memoizedAddLog('Iframe recreated, re-initializing player...');
      const timer = setTimeout(() => {
        loadYouTubeVideo(youtubeVideoId, youtubeUrl, true, true);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [youtubeVideoId, youtubeUrl]);

  // Cleanup YouTube player on unmount
  useEffect(() => {
    return () => {
      if (youtubePlayerManagerRef.current) {
        youtubePlayerManagerRef.current.destroy();
      }
    };
  }, []);

  const resetVideoPlayer = () => {
    // Clear all video states
    clearAllVideoStates();
    
    // Reset all state variables
    setVideoFile(null);
    setYoutubeUrl('');
    setYoutubeVideoId(null);
    setYoutubePlayer(null);
    setDirectVideoUrl('');
    setYoutubeInputUrl('');
    setDirectVideoInputUrl('');
    setDirectVideoLoaded(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setVolume(1);
    setIsVideoMuted(false);
    setPendingCommands([]);
    setIsLoadingVideo(false);
    
    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    // Clean up video element
    if (videoRef.current) {
      videoRef.current.src = '';
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    
    // Clean up YouTube player
    if (youtubePlayerManagerRef.current) {
      try {
        youtubePlayerManagerRef.current.destroy();
      } catch (error) {
        console.error('Error destroying YouTube player:', error);
      }
      youtubePlayerManagerRef.current = null;
    }
  };

  return {
    // State
    videoFile,
    setVideoFile,
    youtubeUrl,
    setYoutubeUrl,
    youtubeVideoId,
    setYoutubeVideoId,
    youtubePlayer,
    setYoutubePlayer,
    directVideoUrl,
    setDirectVideoUrl,
    directVideoLoaded,
    setDirectVideoLoaded,
    youtubeInputUrl,
    directVideoInputUrl,
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    volume,
    isVideoMuted,
    
    // Refs
    videoRef,
    fileInputRef,
    youtubeIframeRef,
    youtubePlayerManagerRef,
    
    // Functions
    handleVideoFileSelect,
    handleYoutubeUrlChange,
    handleYoutubeSubmit,
    handleDirectVideoUrlChange,
    handleDirectVideoSubmit,
    loadYouTubeVideo,
    addPendingCommand,
    executePendingCommands,
    clearAllVideoStates,
    resetVideoPlayer,
    togglePlayPause,
    handleSeek,
    handleVolumeChange,
    toggleVideoMute,
    toggleFullscreen,
    formatTime
  };
};
