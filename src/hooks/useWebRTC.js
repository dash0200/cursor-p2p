import { useState, useRef, useEffect, useCallback } from 'react';

export const useWebRTC = () => {
  const [localOffer, setLocalOffer] = useState('');
  const [localAnswer, setLocalAnswer] = useState('');
  const [remoteDescription, setRemoteDescription] = useState('');
  const [connectionState, setConnectionState] = useState('new');
  const [isInitiator, setIsInitiator] = useState(true);
  const [inVoiceChannel, setInVoiceChannel] = useState(false);
  const [remoteInVoiceChannel, setRemoteInVoiceChannel] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [localVoiceActivity, setLocalVoiceActivity] = useState(false);
  const [remoteVoiceActivity, setRemoteVoiceActivity] = useState(false);
  const [isGeneratingOffer, setIsGeneratingOffer] = useState(false);
  const [logs, setLogs] = useState([]);
  const [connectionTimeout, setConnectionTimeout] = useState(null);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const dataChannelRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const isNegotiatingRef = useRef(false);
  const localAudioContextRef = useRef(null);
  const localAnalyserRef = useRef(null);
  const remoteAudioContextRef = useRef(null);
  const remoteAnalyserRef = useRef(null);
  const localVoiceActivityTimeoutRef = useRef(null);
  const remoteVoiceActivityTimeoutRef = useRef(null);
  const connectionTimeoutRef = useRef(null);
  const cleanupTimeoutRef = useRef(null);
  const isCleaningUpRef = useRef(false);
  const heartbeatIntervalRef = useRef(null);
  const lastHeartbeatRef = useRef(null);

  const addLog = useCallback((message) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  }, []);

  // Comprehensive cleanup function
  const cleanupAllConnections = useCallback(() => {
    if (isCleaningUpRef.current) return;
    isCleaningUpRef.current = true;
    
    addLog('Starting comprehensive cleanup...');
    
    // Clear all timeouts
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    if (cleanupTimeoutRef.current) {
      clearTimeout(cleanupTimeoutRef.current);
      cleanupTimeoutRef.current = null;
    }
    if (localVoiceActivityTimeoutRef.current) {
      clearTimeout(localVoiceActivityTimeoutRef.current);
      localVoiceActivityTimeoutRef.current = null;
    }
    if (remoteVoiceActivityTimeoutRef.current) {
      clearTimeout(remoteVoiceActivityTimeoutRef.current);
      remoteVoiceActivityTimeoutRef.current = null;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    // Stop local media streams
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
        addLog(`Stopped ${track.kind} track`);
      });
      localStreamRef.current = null;
    }

    // Close audio contexts
    if (localAudioContextRef.current) {
      localAudioContextRef.current.close();
      localAudioContextRef.current = null;
    }
    if (remoteAudioContextRef.current) {
      remoteAudioContextRef.current.close();
      remoteAudioContextRef.current = null;
    }

    // Close data channel
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    // Close peer connection
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    // Reset remote audio
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
    }

    // Reset all state
    setConnectionState('new');
    setInVoiceChannel(false);
    setRemoteInVoiceChannel(false);
    setIsMuted(false);
    setLocalVoiceActivity(false);
    setRemoteVoiceActivity(false);
    setIsGeneratingOffer(false);
    setLocalOffer('');
    setLocalAnswer('');
    setRemoteDescription('');
    pendingCandidatesRef.current = [];
    isNegotiatingRef.current = false;
    
    addLog('Cleanup completed');
    isCleaningUpRef.current = false;
  }, [addLog]);

  // Connection state monitoring
  const monitorConnection = useCallback(() => {
    if (!pcRef.current) return;
    
    const pc = pcRef.current;
    const state = pc.connectionState;
    
    addLog(`Monitoring connection state: ${state}`);
    
    // Set up connection timeout
    if (state === 'connecting') {
      connectionTimeoutRef.current = setTimeout(() => {
        if (pcRef.current && pcRef.current.connectionState === 'connecting') {
          addLog('Connection timeout - cleaning up');
          cleanupAllConnections();
        }
      }, 30000); // 30 second timeout
    } else if (state === 'connected') {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      // Start heartbeat when connected
      startHeartbeat();
    } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
      addLog(`Connection ${state} - cleaning up`);
      cleanupTimeoutRef.current = setTimeout(() => {
        cleanupAllConnections();
      }, 1000);
    }
  }, [addLog, cleanupAllConnections]);

  const sendMessage = useCallback((message) => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      if (message.type === 'video-pause' || message.type === 'video-play') {
        console.log('SENDING:', message.type, 'with data:', JSON.stringify(message));
      }
      dataChannelRef.current.send(JSON.stringify(message));
    }
  }, []);

  // Heartbeat mechanism to detect connection health
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    
    lastHeartbeatRef.current = Date.now();
    
    heartbeatIntervalRef.current = setInterval(() => {
      if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') {
        addLog('Data channel not open - stopping heartbeat');
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
        return;
      }
      
      // Send heartbeat
      sendMessage({ type: 'heartbeat', timestamp: Date.now() });
      
      // Check if we haven't received a heartbeat in too long
      const timeSinceLastHeartbeat = Date.now() - lastHeartbeatRef.current;
      if (timeSinceLastHeartbeat > 30000) { // 30 seconds
        addLog('No heartbeat received - connection may be dead');
        cleanupAllConnections();
      }
    }, 10000); // Send heartbeat every 10 seconds
  }, [addLog, sendMessage, cleanupAllConnections]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  const handleDataChannelMessage = async (data, onVideoMessage, onChatMessage) => {
    console.log('handleDataChannelMessage called with:', data);
    try {
      console.log('Raw data received:', data);
      const message = JSON.parse(data);
      console.log('Parsed message:', message);

      if (message.type === 'video-pause' || message.type === 'video-play') {
        console.log('RECEIVED:', message.type, 'with data:', JSON.stringify(message));
      }

      if (message.type === 'offer') {
        if (isNegotiatingRef.current) {
          addLog('Already negotiating, queueing offer');
          return;
        }
        isNegotiatingRef.current = true;

        await pcRef.current.setRemoteDescription(message.sdp);
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);

        for (const candidate of pendingCandidatesRef.current) {
          await pcRef.current.addIceCandidate(candidate);
        }
        pendingCandidatesRef.current = [];

        sendMessage({ type: 'answer', sdp: pcRef.current.localDescription });
        isNegotiatingRef.current = false;
        addLog('Auto-answered renegotiation offer');
      } else if (message.type === 'answer') {
        await pcRef.current.setRemoteDescription(message.sdp);
        isNegotiatingRef.current = false;
        addLog('Renegotiation complete');
      } else if (message.type === 'ice-candidate' && message.candidate) {
        if (pcRef.current.remoteDescription && pcRef.current.remoteDescription.type) {
          await pcRef.current.addIceCandidate(message.candidate);
          addLog('Added ICE candidate');
        } else {
          pendingCandidatesRef.current.push(message.candidate);
          addLog('Queued ICE candidate');
        }
      } else if (message.type === 'voice-join') {
        setRemoteInVoiceChannel(true);
        addLog('Remote peer joined voice channel');
      } else if (message.type === 'voice-leave') {
        setRemoteInVoiceChannel(false);
        if (remoteAudioRef.current) {
          remoteAudioRef.current.pause();
          remoteAudioRef.current.srcObject = null;
        }
        addLog('Remote peer left voice channel');
      } else if (message.type === 'heartbeat') {
        lastHeartbeatRef.current = Date.now();
        // Don't log every heartbeat to avoid spam
      } else if (message.type === 'chat' && onChatMessage) {
        onChatMessage(message);
      } else if (['video-play', 'video-pause', 'video-seek', 'video-file', 'youtube-video', 'youtube-play', 'youtube-pause', 'youtube-seek', 'direct-video'].includes(message.type) && onVideoMessage) {
        onVideoMessage(message);
      }
    } catch (err) {
      addLog(`Error handling message: ${err.message}`);
      isNegotiatingRef.current = false;
    }
  };

  const setupDataChannel = (channel, onVideoMessage, onChatMessage) => {
    dataChannelRef.current = channel;

    channel.onopen = () => {
      addLog('Data channel opened - ready for voice chat');
    };

    channel.onclose = () => {
      addLog('Data channel closed');
    };

    channel.onmessage = (e) => {
      console.log('Data channel onmessage triggered with:', e.data);
      handleDataChannelMessage(e.data, onVideoMessage, onChatMessage);
    };
  };

  const createPeerConnection = () => {
    if (pcRef.current) {
      pcRef.current.close();
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 10, // Pre-gather ICE candidates
      bundlePolicy: 'max-bundle', // Reduce number of transports
      rtcpMuxPolicy: 'require' // Reduce number of ports
    });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
          sendMessage({ type: 'ice-candidate', candidate: e.candidate });
        }
      }
    };

    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
      addLog(`Connection state: ${pc.connectionState}`);
      monitorConnection();
    };

    pc.ontrack = (e) => {
      addLog('Received remote audio track');
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = e.streams[0];
        addLog(`Remote audio stream set. We're in voice: ${inVoiceChannel}, Remote in voice: ${remoteInVoiceChannel}`);
        remoteAudioRef.current.pause();
        addLog('Remote audio paused - waiting for both peers to be in voice channel');
        
        // Setup voice activity detection for remote audio
        setupRemoteVoiceActivityDetection();
      }
    };

    pc.onnegotiationneeded = async () => {
      try {
        if (dataChannelRef.current && dataChannelRef.current.readyState === 'open' && !isNegotiatingRef.current) {
          isNegotiatingRef.current = true;
          addLog('Negotiation needed - creating offer');
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendMessage({ type: 'offer', sdp: pc.localDescription });
        }
      } catch (err) {
        addLog(`Negotiation error: ${err.message}`);
        isNegotiatingRef.current = false;
      }
    };

    pcRef.current = pc;
    return pc;
  };

  const createDataChannelOffer = async (onVideoMessage, onChatMessage) => {
    setIsGeneratingOffer(true);
    addLog('Creating data channel offer...');
    
    // Log browser and performance info
    addLog(`Browser: ${navigator.userAgent.split(' ').slice(-2).join(' ')}`);
    addLog(`Connection: ${navigator.connection?.effectiveType || 'Unknown'}`);
    
    const startTime = Date.now();
    
    try {
      const pc = createPeerConnection();

      const dataChannel = pc.createDataChannel('signaling');
      setupDataChannel(dataChannel, onVideoMessage, onChatMessage);

      addLog('Generating offer...');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      addLog('Gathering ICE candidates...');
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          addLog('ICE gathering timeout - proceeding with available candidates');
          resolve(); // Don't fail, just proceed with what we have
        }, 10000); // 10 second timeout

        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          resolve();
        } else {
          pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === 'complete') {
              clearTimeout(timeout);
              resolve();
            }
          };
        }
      });

      setLocalOffer(JSON.stringify(pc.localDescription, null, 2));
      setIsInitiator(true);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      addLog(`Offer created in ${duration}ms - send to remote peer`);
    } catch (error) {
      addLog(`Error creating offer: ${error.message}`);
    } finally {
      setIsGeneratingOffer(false);
    }
  };

  const handleRemoteDescription = async (onVideoMessage, onChatMessage) => {
    if (!remoteDescription.trim()) {
      alert('Please paste the remote description');
      return;
    }

    try {
      const desc = JSON.parse(remoteDescription);
      const pc = pcRef.current;

      if (desc.type === 'offer') {
        if (!pc) {
          createPeerConnection();
        }

        await pcRef.current.setRemoteDescription(desc);
        addLog('Remote offer set');

        pcRef.current.ondatachannel = (e) => {
          setupDataChannel(e.channel, onVideoMessage, onChatMessage);
        };

        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);

        await new Promise(resolve => {
          if (pcRef.current.iceGatheringState === 'complete') {
            resolve();
          } else {
            pcRef.current.onicegatheringstatechange = () => {
              if (pcRef.current.iceGatheringState === 'complete') {
                resolve();
              }
            };
          }
        });

        setLocalAnswer(JSON.stringify(pcRef.current.localDescription, null, 2));
        setIsInitiator(false);
        addLog('Answer created - send to remote peer');
      } else if (desc.type === 'answer') {
        await pcRef.current.setRemoteDescription(desc);
        addLog('Connection established! You can now join voice channel');
      }

      setRemoteDescription('');
    } catch (err) {
      alert('Error processing remote description: ' + err.message);
      addLog(`Error: ${err.message}`);
    }
  };

  const joinVoiceChannel = async () => {
    if (!pcRef.current || pcRef.current.connectionState !== 'connected') {
      alert('Please establish a connection first');
      return;
    }

    if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') {
      alert('Data channel not ready');
      return;
    }

    try {
      addLog('Joining voice channel...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      stream.getTracks().forEach(track => {
        pcRef.current.addTrack(track, stream);
        addLog(`Added ${track.kind} track to peer connection`);
      });

      setInVoiceChannel(true);
      sendMessage({ type: 'voice-join' });
      addLog('Joined voice channel - audio streaming');
      
      // Setup voice activity detection for local audio
      setupLocalVoiceActivityDetection();

      if (pcRef.current && dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
        addLog('Triggering renegotiation for audio tracks');
        const offer = await pcRef.current.createOffer();
        await pcRef.current.setLocalDescription(offer);
        sendMessage({ type: 'offer', sdp: pcRef.current.localDescription });
      }
    } catch (err) {
      alert('Error joining voice channel: ' + err.message);
      addLog(`Error: ${err.message}`);
    }
  };

  const leaveVoiceChannel = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
        const senders = pcRef.current.getSenders();
        const sender = senders.find(s => s.track === track);
        if (sender) {
          pcRef.current.removeTrack(sender);
        }
      });
      localStreamRef.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
    }

    // Cleanup voice activity detection
    if (localAudioContextRef.current) {
      localAudioContextRef.current.close();
      localAudioContextRef.current = null;
    }
    if (remoteAudioContextRef.current) {
      remoteAudioContextRef.current.close();
      remoteAudioContextRef.current = null;
    }
    if (localVoiceActivityTimeoutRef.current) {
      clearTimeout(localVoiceActivityTimeoutRef.current);
    }
    if (remoteVoiceActivityTimeoutRef.current) {
      clearTimeout(remoteVoiceActivityTimeoutRef.current);
    }
    setLocalVoiceActivity(false);
    setRemoteVoiceActivity(false);

    setInVoiceChannel(false);
    setIsMuted(false);
    setRemoteInVoiceChannel(false);
    sendMessage({ type: 'voice-leave' });
    addLog('Left voice channel');
  };

  // Reset connection function
  const resetConnection = useCallback(() => {
    addLog('Resetting connection...');
    cleanupAllConnections();
  }, [cleanupAllConnections]);

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
      addLog(isMuted ? 'Unmuted' : 'Muted');
    }
  };

  // Voice activity detection functions
  const setupLocalVoiceActivityDetection = useCallback(() => {
    if (!localStreamRef.current) return;

    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(localStreamRef.current);
      
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      microphone.connect(analyser);
      
      localAudioContextRef.current = audioContext;
      localAnalyserRef.current = analyser;
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const detectVoiceActivity = () => {
        if (!localAnalyserRef.current || isMuted) {
          setLocalVoiceActivity(false);
          return;
        }
        
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const threshold = 20; // Adjust this value to change sensitivity
        
        if (average > threshold) {
          setLocalVoiceActivity(true);
          // Clear any existing timeout
          if (localVoiceActivityTimeoutRef.current) {
            clearTimeout(localVoiceActivityTimeoutRef.current);
          }
          // Set timeout to turn off voice activity after 500ms of silence
          localVoiceActivityTimeoutRef.current = setTimeout(() => {
            setLocalVoiceActivity(false);
          }, 500);
        }
        
        requestAnimationFrame(detectVoiceActivity);
      };
      
      detectVoiceActivity();
    } catch (error) {
      console.error('Error setting up local voice activity detection:', error);
    }
  }, [isMuted]);

  const setupRemoteVoiceActivityDetection = useCallback(() => {
    if (!remoteAudioRef.current || !remoteAudioRef.current.srcObject) return;

    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(remoteAudioRef.current.srcObject);
      
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      
      remoteAudioContextRef.current = audioContext;
      remoteAnalyserRef.current = analyser;
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const detectVoiceActivity = () => {
        if (!remoteAnalyserRef.current) {
          setRemoteVoiceActivity(false);
          return;
        }
        
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const threshold = 15; // Adjust this value to change sensitivity
        
        if (average > threshold) {
          setRemoteVoiceActivity(true);
          // Clear any existing timeout
          if (remoteVoiceActivityTimeoutRef.current) {
            clearTimeout(remoteVoiceActivityTimeoutRef.current);
          }
          // Set timeout to turn off voice activity after 500ms of silence
          remoteVoiceActivityTimeoutRef.current = setTimeout(() => {
            setRemoteVoiceActivity(false);
          }, 500);
        }
        
        requestAnimationFrame(detectVoiceActivity);
      };
      
      detectVoiceActivity();
    } catch (error) {
      console.error('Error setting up remote voice activity detection:', error);
    }
  }, []);

  const forceStartRemoteAudio = () => {
    if (inVoiceChannel && remoteInVoiceChannel && remoteAudioRef.current && remoteAudioRef.current.srcObject) {
      addLog('Force starting remote audio playback');
      remoteAudioRef.current.play().catch(err => {
        console.log('Force play failed:', err);
        addLog('Force play failed - user interaction may be required');
        setTimeout(() => {
          if (remoteAudioRef.current && inVoiceChannel && remoteInVoiceChannel) {
            addLog('Retrying remote audio playback after delay');
            remoteAudioRef.current.play().catch(err2 => {
              console.log('Retry also failed:', err2);
              addLog('Retry also failed - may need user interaction');
            });
          }
        }, 500);
      });
    } else {
      addLog(`Cannot force start audio - inVoice: ${inVoiceChannel}, remoteInVoice: ${remoteInVoiceChannel}, hasStream: ${!!remoteAudioRef.current?.srcObject}`);
    }
  };

  // Cleanup on unmount and page events
  useEffect(() => {
    const handleBeforeUnload = (event) => {
      addLog('Page unloading - cleaning up connections');
      cleanupAllConnections();
      // Note: We can't prevent the unload, but we try to clean up
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        addLog('Page hidden - monitoring connection');
        // Don't immediately cleanup, just monitor
      } else {
        addLog('Page visible - checking connection state');
        if (pcRef.current) {
          monitorConnection();
        }
      }
    };

    const handleOnline = () => {
      addLog('Network online - checking connection');
      if (pcRef.current) {
        monitorConnection();
      }
    };

    const handleOffline = () => {
      addLog('Network offline - cleaning up connections');
      cleanupAllConnections();
    };

    const handleError = (event) => {
      addLog(`Page error detected: ${event.message || 'Unknown error'}`);
      cleanupAllConnections();
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', (event) => {
      addLog(`Unhandled promise rejection: ${event.reason}`);
      cleanupAllConnections();
    });

    // Cleanup function
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleError);
      
      // Final cleanup
      cleanupAllConnections();
    };
  }, [cleanupAllConnections, monitorConnection, addLog]);

  // Handle remote audio playback when voice channel state changes
  useEffect(() => {
    addLog(`Voice channel state changed - We're in voice: ${inVoiceChannel}, Remote in voice: ${remoteInVoiceChannel}`);

    if (!remoteAudioRef.current) {
      addLog('No remote audio element available');
      return;
    }

    if (inVoiceChannel && remoteInVoiceChannel) {
      addLog('Both peers in voice channel - starting remote audio playback (useEffect)');
      if (remoteAudioRef.current.srcObject) {
        forceStartRemoteAudio();
      } else {
        addLog('No remote audio stream available yet');
      }
    } else if (!inVoiceChannel) {
      addLog('We left voice channel - pausing remote audio');
      remoteAudioRef.current.pause();
    } else if (!remoteInVoiceChannel) {
      addLog('Remote peer left voice channel - pausing remote audio');
      remoteAudioRef.current.pause();
    }
  }, [inVoiceChannel, remoteInVoiceChannel]);

  // Add audio event listeners to handle when audio becomes ready
  useEffect(() => {
    const audio = remoteAudioRef.current;
    if (!audio) return;

    const handleCanPlay = () => {
      addLog('Remote audio can play - checking if both peers are in voice channel');
      if (inVoiceChannel && remoteInVoiceChannel) {
        addLog('Both peers in voice channel - starting audio from canplay event');
        forceStartRemoteAudio();
      }
    };

    const handleLoadedMetadata = () => {
      addLog('Remote audio metadata loaded - checking if both peers are in voice channel');
      if (inVoiceChannel && remoteInVoiceChannel) {
        addLog('Both peers in voice channel - starting audio from loadedmetadata event');
        forceStartRemoteAudio();
      }
    };

    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [inVoiceChannel, remoteInVoiceChannel]);

  // Aggressive retry mechanism for audio playback
  useEffect(() => {
    if (inVoiceChannel && remoteInVoiceChannel && remoteAudioRef.current && remoteAudioRef.current.srcObject) {
      addLog('Setting up aggressive audio retry mechanism');

      const retryAudio = () => {
        if (remoteAudioRef.current && inVoiceChannel && remoteInVoiceChannel) {
          addLog('Aggressive retry: attempting to start remote audio');
          remoteAudioRef.current.play().catch(err => {
            console.log('Aggressive retry failed:', err);
            addLog('Aggressive retry failed - will try again');
          });
        }
      };

      retryAudio();
      const timeout1 = setTimeout(retryAudio, 1000);
      const timeout2 = setTimeout(retryAudio, 2000);
      const timeout3 = setTimeout(retryAudio, 3000);

      return () => {
        clearTimeout(timeout1);
        clearTimeout(timeout2);
        clearTimeout(timeout3);
      };
    }
  }, [inVoiceChannel, remoteInVoiceChannel]);

  return {
    // State
    localOffer,
    localAnswer,
    remoteDescription,
    setRemoteDescription,
    connectionState,
    isInitiator,
    inVoiceChannel,
    remoteInVoiceChannel,
    isMuted,
    localVoiceActivity,
    remoteVoiceActivity,
    isGeneratingOffer,
    logs,
    
    // Refs
    pcRef,
    localStreamRef,
    remoteAudioRef,
    dataChannelRef,
    
    // Functions
    createDataChannelOffer,
    handleRemoteDescription,
    joinVoiceChannel,
    leaveVoiceChannel,
    toggleMute,
    sendMessage,
    addLog,
    handleDataChannelMessage,
    cleanupAllConnections,
    resetConnection,
    startHeartbeat,
    stopHeartbeat
  };
};
