import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Copy, Check, Phone, PhoneOff, Volume2, VolumeX, Play, Pause, Maximize, Upload } from 'lucide-react';
import './WebRTCManualSignal.css';

export default function WebRTCManualSignal() {
  const [localOffer, setLocalOffer] = useState('');
  const [localAnswer, setLocalAnswer] = useState('');
  const [remoteDescription, setRemoteDescription] = useState('');
  const [connectionState, setConnectionState] = useState('new');
  const [isInitiator, setIsInitiator] = useState(true);
  const [copied, setCopied] = useState(false);
  const [inVoiceChannel, setInVoiceChannel] = useState(false);
  const [remoteInVoiceChannel, setRemoteInVoiceChannel] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('voice');
  const [videoFile, setVideoFile] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const logContainerRef = useRef(null);
  const chatContainerRef = useRef(null);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const dataChannelRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const isNegotiatingRef = useRef(false);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);

  const addLog = (message) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.pause();
        remoteAudioRef.current.srcObject = null;
      }
      if (pcRef.current) {
        pcRef.current.close();
      }
    };
  }, []);

  const sendMessage = (message) => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      dataChannelRef.current.send(JSON.stringify(message));
    }
  };

  const handleDataChannelMessage = async (data) => {
    try {
      const message = JSON.parse(data);

      if (message.type === 'offer') {
        if (isNegotiatingRef.current) {
          addLog('Already negotiating, queueing offer');
          return;
        }
        isNegotiatingRef.current = true;
        
        await pcRef.current.setRemoteDescription(message.sdp);
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        
        // Add any pending candidates
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
        // Let the useEffect handle audio playback based on state changes
      } else if (message.type === 'voice-leave') {
        setRemoteInVoiceChannel(false);
        // Stop remote audio when remote peer leaves
        if (remoteAudioRef.current) {
          remoteAudioRef.current.pause();
          remoteAudioRef.current.srcObject = null;
        }
        addLog('Remote peer left voice channel');
      } else if (message.type === 'chat') {
        setChatMessages(prev => [...prev, {
          type: 'chat',
          text: message.text,
          timestamp: message.timestamp,
          sender: 'Remote'
        }]);
      }
    } catch (err) {
      addLog(`Error handling message: ${err.message}`);
      isNegotiatingRef.current = false;
    }
  };

  const setupDataChannel = (channel) => {
    dataChannelRef.current = channel;
    
    channel.onopen = () => {
      addLog('Data channel opened - ready for voice chat');
    };
    
    channel.onclose = () => {
      addLog('Data channel closed');
    };
    
    channel.onmessage = (e) => {
      handleDataChannelMessage(e.data);
    };
  };

  const createPeerConnection = () => {
    if (pcRef.current) {
      pcRef.current.close();
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
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
    };

    pc.ontrack = (e) => {
      addLog('Received remote audio track');
      // Store the remote stream but don't play it yet
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = e.streams[0];
        addLog(`Remote audio stream set. We're in voice: ${inVoiceChannel}, Remote in voice: ${remoteInVoiceChannel}`);
        // Always pause initially - let the useEffect handle playback
        remoteAudioRef.current.pause();
        addLog('Remote audio paused - waiting for both peers to be in voice channel');
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

  const createDataChannelOffer = async () => {
    addLog('Creating data channel offer...');
    const pc = createPeerConnection();
    
    const dataChannel = pc.createDataChannel('signaling');
    setupDataChannel(dataChannel);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await new Promise(resolve => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
      } else {
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === 'complete') {
            resolve();
          }
        };
      }
    });

    setLocalOffer(JSON.stringify(pc.localDescription, null, 2));
    setIsInitiator(true);
    addLog('Offer created - send to remote peer');
  };

  const handleRemoteDescription = async () => {
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
          setupDataChannel(e.channel);
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

      // Add audio tracks to peer connection
      stream.getTracks().forEach(track => {
        pcRef.current.addTrack(track, stream);
        addLog(`Added ${track.kind} track to peer connection`);
      });

      setInVoiceChannel(true);
      sendMessage({ type: 'voice-join' });
      addLog('Joined voice channel - audio streaming');
      
      // Force a renegotiation to ensure audio tracks are properly transmitted
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
    
    // Stop remote audio playback
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
    }
    
    setInVoiceChannel(false);
    setIsMuted(false);
    setRemoteInVoiceChannel(false); // Also reset remote state
    sendMessage({ type: 'voice-leave' });
    addLog('Left voice channel');
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
      addLog(isMuted ? 'Unmuted' : 'Muted');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };


  const handleVideoFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
      const videoUrl = URL.createObjectURL(file);
      if (videoRef.current) {
        videoRef.current.src = videoUrl;
        // Auto-play the video after loading
        videoRef.current.onloadeddata = () => {
          videoRef.current.play().then(() => {
            setIsPlaying(true);
          }).catch((error) => {
            console.log('Autoplay prevented:', error);
          });
        };
      }
    }
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch((error) => {
          console.log('Play failed:', error);
        });
      }
    }
  };

  const handleSeek = (e) => {
    if (videoRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const width = rect.width;
      const newTime = (clickX / width) * duration;
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
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

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const forceStartRemoteAudio = () => {
    if (inVoiceChannel && remoteInVoiceChannel && remoteAudioRef.current && remoteAudioRef.current.srcObject) {
      addLog('Force starting remote audio playback');
      remoteAudioRef.current.play().catch(err => {
        console.log('Force play failed:', err);
        addLog('Force play failed - user interaction may be required');
        // Try again after a short delay
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

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const sendChatMessage = () => {
    if (chatMessage.trim() && dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      const message = {
        type: 'chat',
        text: chatMessage.trim(),
        timestamp: new Date().toLocaleTimeString(),
        sender: 'You'
      };
      
      setChatMessages(prev => [...prev, message]);
      sendMessage({ type: 'chat', text: chatMessage.trim(), timestamp: message.timestamp });
      setChatMessage('');
    }
  };

  const handleChatKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  };

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (chatContainerRef.current) {
      // Use requestAnimationFrame for smoother scrolling
      requestAnimationFrame(() => {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      });
    }
  }, [chatMessages]);

  // Auto-scroll logs container
  useEffect(() => {
    if (logContainerRef.current) {
      requestAnimationFrame(() => {
        logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      });
    }
  }, [logs]);

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
    
    switch(e.key) {
      case ' ':
        e.preventDefault();
        togglePlayPause();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - 10);
        break;
      case 'ArrowRight':
        e.preventDefault();
        video.currentTime = Math.min(video.duration, video.currentTime + 10);
        break;
      case 'ArrowUp':
        e.preventDefault();
        video.volume = Math.min(1, video.volume + 0.1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        video.volume = Math.max(0, video.volume - 0.1);
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

  // Handle remote audio playback when voice channel state changes
  useEffect(() => {
    addLog(`Voice channel state changed - We're in voice: ${inVoiceChannel}, Remote in voice: ${remoteInVoiceChannel}`);
    
    if (!remoteAudioRef.current) {
      addLog('No remote audio element available');
      return;
    }

    if (inVoiceChannel && remoteInVoiceChannel) {
      // Both peers are in voice channel, start playing remote audio
      addLog('Both peers in voice channel - starting remote audio playback (useEffect)');
      if (remoteAudioRef.current.srcObject) {
        // Use the same logic as the manual button
        forceStartRemoteAudio();
      } else {
        addLog('No remote audio stream available yet');
      }
    } else if (!inVoiceChannel) {
      // We're not in voice channel, pause remote audio
      addLog('We left voice channel - pausing remote audio');
      remoteAudioRef.current.pause();
    } else if (!remoteInVoiceChannel) {
      // Remote peer is not in voice channel, pause remote audio
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
  }, [inVoiceChannel, remoteInVoiceChannel]); // Re-add listeners when voice channel state changes

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

      // Try immediately
      retryAudio();
      
      // Try after 1 second
      const timeout1 = setTimeout(retryAudio, 1000);
      
      // Try after 2 seconds
      const timeout2 = setTimeout(retryAudio, 2000);
      
      // Try after 3 seconds
      const timeout3 = setTimeout(retryAudio, 3000);

      return () => {
        clearTimeout(timeout1);
        clearTimeout(timeout2);
        clearTimeout(timeout3);
      };
    }
  }, [inVoiceChannel, remoteInVoiceChannel]);

  return (
    <div className={`webrtc-container ${connectionState === 'connected' ? 'connected' : ''} ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Left Side (75% when sidebar visible, 100% when collapsed) */}
      <div className="webrtc-left">
        {connectionState !== 'connected' && (
          <div className="webrtc-header">
            <h1 className="webrtc-title">
              WebRTC Voice Channel
            </h1>
            <p className="webrtc-subtitle">
              Discord-style voice channel - join and start talking automatically
            </p>
            
            <div className="status-indicators">
              <div className="status-indicator">
                <div className={`status-dot ${connectionState}`} />
                <span className="status-text">
                  {connectionState}
                </span>
              </div>
              {dataChannelRef.current && dataChannelRef.current.readyState === 'open' && (
                <div className="status-indicator">
                  <div className="status-dot data-channel" />
                  <span className="status-text data-channel">Data Channel Open</span>
                </div>
              )}
            </div>
          </div>
        )}

        {connectionState !== 'connected' && (
          <div className="connection-grid">
            <div className="webrtc-card">
              <h2 className="card-title">
                Step 1: Create Connection
              </h2>
              
              <button
                onClick={createDataChannelOffer}
                className="neumorphic-btn primary"
              >
                Create Offer
              </button>

              {localOffer && (
                <div style={{ marginBottom: '16px' }}>
                  <div className="copy-section">
                    <label className="webrtc-label">
                      Your Offer:
                    </label>
                    <button
                      onClick={() => copyToClipboard(localOffer)}
                      className="copy-btn"
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <textarea
                    value={localOffer}
                    readOnly
                    className="webrtc-textarea"
                    onClick={(e) => e.target.select()}
                  />
                </div>
              )}

              {localAnswer && (
                <div style={{ marginBottom: '16px' }}>
                  <div className="copy-section">
                    <label className="webrtc-label">
                      Your Answer:
                    </label>
                    <button
                      onClick={() => copyToClipboard(localAnswer)}
                      className="copy-btn"
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <textarea
                    value={localAnswer}
                    readOnly
                    className="webrtc-textarea"
                    onClick={(e) => e.target.select()}
                  />
                </div>
              )}
            </div>

            <div className="webrtc-card">
              <h2 className="card-title">
                Step 2: Exchange Descriptions
              </h2>
              
              <label className="webrtc-label">
                Paste Remote Description:
              </label>
              <textarea
                value={remoteDescription}
                onChange={(e) => setRemoteDescription(e.target.value)}
                placeholder="Paste the offer or answer from the other peer here..."
                className="webrtc-textarea"
              />
              
              <button
                onClick={handleRemoteDescription}
                className="neumorphic-btn success"
              >
                Process Remote Description
              </button>
            </div>
          </div>
        )}

        {connectionState === 'connected' && (
          <div className="video-player-container">
          <div className="video-player-wrapper">
            <video
              ref={videoRef}
              className="video-player"
              poster=""
              onClick={togglePlayPause}
            >
              <source src="" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
            
            {!videoFile && (
              <div className="video-placeholder">
                <div className="video-placeholder-content">
                  <h3 className="video-placeholder-title">No Video Selected</h3>
                  <p className="video-placeholder-subtitle">Choose a video file to start playing</p>
                  <button
                    className="video-select-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={24} />
                    Select Video File
                  </button>
                </div>
                </div>
            )}
            
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleVideoFileSelect}
              style={{ display: 'none' }}
            />
            
            {videoFile && (
              <div className="video-overlay">
                <div className="video-controls">
                  <button 
                    className="video-control-btn"
                    onClick={togglePlayPause}
                    title={`${isPlaying ? 'Pause' : 'Play'} (Space)`}
                  >
                    {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                  <div className="video-progress">
                    <div 
                      className="progress-bar"
                      onClick={handleSeek}
                    >
                      <div 
                        className="progress-fill"
                        style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                      ></div>
              </div>
                  </div>
                  <div className="video-time">
                    <span>{formatTime(currentTime)}</span>
                    <span>/</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                  <div className="volume-controls">
                  <button 
                    className="video-control-btn"
                    onClick={toggleVideoMute}
                    title={`${isVideoMuted ? 'Unmute' : 'Mute'} (M)`}
                  >
                    {isVideoMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={isVideoMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="volume-slider"
                    />
                  </div>
                  <button 
                    className="video-control-btn"
                    onClick={toggleFullscreen}
                    title="Fullscreen (F)"
                  >
                    <Maximize size={16} />
                  </button>
                  <button 
                    className="video-control-btn"
                    onClick={() => fileInputRef.current?.click()}
                    title="Change Video"
                  >
                    <Upload size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        )}
            </div>

      {/* Sidebar Toggle Button - Only show when connected */}
      {connectionState === 'connected' && (
        <button 
          className={`sidebar-toggle ${isSidebarCollapsed ? 'collapsed' : ''}`}
          onClick={toggleSidebar}
          title={isSidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
        >
          {isSidebarCollapsed ? '◀' : '▶'}
        </button>
      )}

      {/* Neumorphic Gutter - Only show when connected and not collapsed */}
      {connectionState === 'connected' && !isSidebarCollapsed && <div className="webrtc-gutter"></div>}

      {/* Right Side (25%) - Only show when connected and not collapsed */}
      {connectionState === 'connected' && !isSidebarCollapsed && (
        <div className="webrtc-right">
        <div className="tabs-header">
          <button
            className={`tab-button ${activeTab === 'voice' ? 'active' : ''}`}
            onClick={() => setActiveTab('voice')}
          >
            Voice
          </button>
          <button
            className={`tab-button ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            Chat
          </button>
          <button
            className={`tab-button ${activeTab === 'log' ? 'active' : ''}`}
            onClick={() => setActiveTab('log')}
          >
            Logs
          </button>
        </div>
          
            {/* Voice Channel Tab */}
            <div className={`tab-panel ${activeTab !== 'voice' ? 'hidden' : ''}`}>
              <div className="voice-channel-card">

                <div className="voice-channel-visual">
                  <div className="voice-avatar">
                    <div className={`voice-avatar-circle ${inVoiceChannel ? 'active' : ''}`}>
                      <Volume2 style={{ color: 'white' }} size={24} />
                    </div>
                    <p className="voice-avatar-name">You</p>
                    <p className="voice-avatar-status">{inVoiceChannel ? 'Connected' : 'Not in channel'}</p>
                </div>

                  <div className="audio-visualization">
                    <div className="audio-bars">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                          className={`audio-bar ${inVoiceChannel && remoteInVoiceChannel ? 'active' : ''}`}
                          style={{ animationDelay: `${i * 0.1}s` }}
                      />
                    ))}
                  </div>
                </div>

                  <div className="voice-avatar">
                    <div className={`voice-avatar-circle ${remoteInVoiceChannel ? 'active' : ''}`}>
                      <Volume2 style={{ color: 'white' }} size={24} />
                  </div>
                    <p className="voice-avatar-name">Remote</p>
                    <p className="voice-avatar-status">{remoteInVoiceChannel ? 'Connected' : 'Not in channel'}</p>
              </div>
            </div>

              {!inVoiceChannel ? (
                <button
                  onClick={joinVoiceChannel}
                      className="voice-control-btn join"
                    >
                      <Phone size={16} />
                      Join Voice
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={toggleMute}
                        className={`voice-control-btn mute ${isMuted ? 'active' : ''}`}
                      >
                        {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                    {isMuted ? 'Unmute' : 'Mute'}
                  </button>
                  <button
                    onClick={leaveVoiceChannel}
                        className="voice-control-btn leave"
                      >
                        <PhoneOff size={16} />
                        Leave
                  </button>
                </div>
              )}

                <audio ref={remoteAudioRef} autoPlay className="webrtc-audio" />
          </div>
            </div>

            {/* Chat Tab */}
            <div className={`tab-panel ${activeTab !== 'chat' ? 'hidden' : ''}`}>
              <div className="log-card">
                <div className="chat-container" ref={chatContainerRef}>
                  {chatMessages.length === 0 ? (
                    <div className="log-empty">No messages yet</div>
                  ) : (
                    chatMessages.map((msg, index) => (
                      <div key={index} className={`chat-message ${msg.sender === 'You' ? 'sent' : 'received'}`}>
                        <div className="message-content">
                          <div className="message-bubble">
                            <div className="message-text">{msg.text}</div>
                          </div>
                          <div className="message-time">{msg.timestamp}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="chat-input-container">
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyPress={handleChatKeyPress}
                    placeholder="Type a message..."
                    className="chat-input"
                  />
                  <button
                    onClick={sendChatMessage}
                    className="chat-send-btn"
                    disabled={!chatMessage.trim()}
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>

            {/* Log Tab */}
            <div className={`tab-panel ${activeTab !== 'log' ? 'hidden' : ''}`}>
              <div className="log-card">
                <div className="log-container" ref={logContainerRef}>
                  {logs.length === 0 ? (
                    <div className="log-empty">No logs yet</div>
                  ) : (
                    logs.map((log, index) => (
                      <div key={index} className="log-entry">
                        {log}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            
        </div>
      )}
    </div>
  );
}