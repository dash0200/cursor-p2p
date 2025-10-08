import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Copy, Check, Phone, PhoneOff, Volume2, Play, Pause, Maximize, Upload } from 'lucide-react';
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
      if (pcRef.current) {
        pcRef.current.close();
      }
    };
  }, []);

  const sendMessage = (message) => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      dataChannelRef.current.send(JSON.stringify(message));
      addLog(`Sent: ${message.type}`);
    }
  };

  const handleDataChannelMessage = async (data) => {
    try {
      const message = JSON.parse(data);
      addLog(`Received: ${message.type}`);

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
        // If we're also in voice, start sending audio
        if (inVoiceChannel && localStreamRef.current) {
          addLog('Both peers in voice channel');
        }
      } else if (message.type === 'voice-leave') {
        setRemoteInVoiceChannel(false);
        addLog('Remote peer left voice channel');
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
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = e.streams[0];
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
      });

      setInVoiceChannel(true);
      sendMessage({ type: 'voice-join' });
      addLog('Joined voice channel - audio streaming');
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
    
    setInVoiceChannel(false);
    setIsMuted(false);
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

  // Add event listeners for video state changes
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      const handlePlay = () => setIsPlaying(true);
      const handlePause = () => setIsPlaying(false);
      const handleEnded = () => setIsPlaying(false);

      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);
      video.addEventListener('ended', handleEnded);

      return () => {
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
        video.removeEventListener('ended', handleEnded);
      };
    }
  }, [videoFile]);

  return (
    <div className="webrtc-container">
      {/* Left Side (75%) */}
      <div className="webrtc-left">
        <div className="video-player-container">
          <div className="video-player-wrapper">
            <video
              ref={videoRef}
              className="video-player"
              poster=""
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
                  >
                    {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                  <div className="video-progress">
                    <div className="progress-bar">
                      <div className="progress-fill"></div>
                    </div>
                  </div>
                  <div className="video-time">
                    <span>00:00</span>
                    <span>/</span>
                    <span>00:00</span>
                  </div>
                  <button className="video-control-btn">
                    <Volume2 size={16} />
                  </button>
                  <button className="video-control-btn">
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
      </div>

      {/* Neumorphic Gutter */}
      <div className="webrtc-gutter"></div>

      {/* Right Side (25%) */}
      <div className="webrtc-right">
        <div className="tabs-header">
          <button
            className={`tab-button ${activeTab === 'voice' ? 'active' : ''}`}
            onClick={() => setActiveTab('voice')}
          >
            Voice Channels
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

                <div className="voice-controls">
                  {!inVoiceChannel ? (
                    <button
                      onClick={joinVoiceChannel}
                      className="voice-control-btn join"
                    >
                      <Phone size={16} />
                      Join Voice
                    </button>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>

                <audio ref={remoteAudioRef} autoPlay className="webrtc-audio" />
              </div>
            </div>

            {/* Log Tab */}
            <div className={`tab-panel ${activeTab !== 'log' ? 'hidden' : ''}`}>
              <div className="log-card">
                <h2 className="log-title">
                  Connection Log
                </h2>
                <div className="log-container">
                  {logs.length === 0 ? (
                    <p className="log-empty">No events yet...</p>
                  ) : (
                    logs.map((log, i) => (
                      <div key={i} className="log-entry">
                        {log}
                      </div>
                    ))
                  )}
                </div>
              </div>
            
            </div>
      </div>
    </div>
  );
}