import { useState, useRef, useEffect } from 'react';

export const useWebRTC = () => {
  const [localOffer, setLocalOffer] = useState('');
  const [localAnswer, setLocalAnswer] = useState('');
  const [remoteDescription, setRemoteDescription] = useState('');
  const [connectionState, setConnectionState] = useState('new');
  const [isInitiator, setIsInitiator] = useState(true);
  const [inVoiceChannel, setInVoiceChannel] = useState(false);
  const [remoteInVoiceChannel, setRemoteInVoiceChannel] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [inVideoChannel, setInVideoChannel] = useState(false);
  const [remoteInVideoChannel, setRemoteInVideoChannel] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [logs, setLogs] = useState([]);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const localVideoStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const dataChannelRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const isNegotiatingRef = useRef(false);

  const addLog = (message) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const sendMessage = (message) => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      if (message.type === 'video-pause' || message.type === 'video-play') {
        console.log('SENDING:', message.type, 'with data:', JSON.stringify(message));
      }
      dataChannelRef.current.send(JSON.stringify(message));
    }
  };

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
      } else if (message.type === 'video-join') {
        setRemoteInVideoChannel(true);
        addLog('Remote peer joined video channel');
      } else if (message.type === 'video-leave') {
        setRemoteInVideoChannel(false);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.pause();
          remoteVideoRef.current.srcObject = null;
        }
        addLog('Remote peer left video channel');
      } else if (message.type === 'peer-disconnected') {
        // Handle peer disconnection - turn off camera and mic
        setRemoteInVoiceChannel(false);
        setRemoteInVideoChannel(false);
        if (remoteAudioRef.current) {
          remoteAudioRef.current.pause();
          remoteAudioRef.current.srcObject = null;
        }
        if (remoteVideoRef.current) {
          remoteVideoRef.current.pause();
          remoteVideoRef.current.srcObject = null;
        }
        addLog('Remote peer disconnected - turning off camera and mic');
      } else if (message.type === 'chat' && onChatMessage) {
        onChatMessage(message);
      } else if (['video-play', 'video-pause', 'video-seek', 'video-file'].includes(message.type) && onVideoMessage) {
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
      // When data channel closes, clear remote streams but don't auto-leave
      setRemoteInVoiceChannel(false);
      setRemoteInVideoChannel(false);
      if (remoteAudioRef.current) {
        remoteAudioRef.current.pause();
        remoteAudioRef.current.srcObject = null;
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.pause();
        remoteVideoRef.current.srcObject = null;
      }
      addLog('Data channel closed - remote streams cleared');
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
      
      // Handle peer disconnection - only clear remote streams, don't auto-leave
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        setRemoteInVoiceChannel(false);
        setRemoteInVideoChannel(false);
        if (remoteAudioRef.current) {
          remoteAudioRef.current.pause();
          remoteAudioRef.current.srcObject = null;
        }
        if (remoteVideoRef.current) {
          remoteVideoRef.current.pause();
          remoteVideoRef.current.srcObject = null;
        }
        addLog('Peer connection lost - remote streams cleared');
      }
    };

    pc.ontrack = (e) => {
      const stream = e.streams[0];
      const track = e.track;
      
      console.log('ontrack event received:', {
        trackKind: track.kind,
        trackId: track.id,
        streamId: stream.id,
        streamTracks: stream.getTracks().map(t => ({ kind: t.kind, id: t.id }))
      });
      
      if (track.kind === 'audio') {
        addLog('Received remote audio track');
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          addLog(`Remote audio stream set. We're in voice: ${inVoiceChannel}, Remote in voice: ${remoteInVoiceChannel}`);
          remoteAudioRef.current.pause();
          addLog('Remote audio paused - waiting for both peers to be in voice channel');
        }
      } else if (track.kind === 'video') {
        addLog('Received remote video track');
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
          addLog(`Remote video stream set. We're in video: ${inVideoChannel}, Remote in video: ${remoteInVideoChannel}`);
          console.log('Remote video element:', remoteVideoRef.current);
          console.log('Remote video stream:', stream);
          
          // Try to play the remote video
          remoteVideoRef.current.play().catch(err => {
            console.log('Remote video play failed:', err);
            addLog('Remote video play failed: ' + err.message);
          });
        } else {
          addLog('Warning: remoteVideoRef.current is null');
          console.log('remoteVideoRef:', remoteVideoRef);
        }
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
    addLog('Creating data channel offer...');
    const pc = createPeerConnection();

    const dataChannel = pc.createDataChannel('signaling');
    setupDataChannel(dataChannel, onVideoMessage, onChatMessage);

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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      localStreamRef.current = stream;
      localVideoStreamRef.current = stream;

      stream.getTracks().forEach(track => {
        pcRef.current.addTrack(track, stream);
        addLog(`Added ${track.kind} track to peer connection`);
        console.log(`Track details:`, {
          kind: track.kind,
          enabled: track.enabled,
          readyState: track.readyState,
          id: track.id
        });
      });

      // Log all senders to verify tracks are added
      const senders = pcRef.current.getSenders();
      console.log('Current senders:', senders.map(sender => ({
        track: sender.track?.kind,
        trackId: sender.track?.id,
        trackEnabled: sender.track?.enabled
      })));

      setInVoiceChannel(true);
      setInVideoChannel(true);
      sendMessage({ type: 'voice-join' });
      sendMessage({ type: 'video-join' });
      addLog('Joined voice and video channel - streaming audio and video');

      // Store the local video stream
      localVideoStreamRef.current = stream;
      addLog('Local video stream stored');
      console.log('Local video stream:', stream);

      if (pcRef.current && dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
        addLog('Triggering renegotiation for audio and video tracks');
        const offer = await pcRef.current.createOffer();
        await pcRef.current.setLocalDescription(offer);
        sendMessage({ type: 'offer', sdp: pcRef.current.localDescription });
        
        // Log offer details
        console.log('Created offer with tracks:', {
          offer: offer,
          localDescription: pcRef.current.localDescription,
          senders: pcRef.current.getSenders().map(s => ({
            track: s.track?.kind,
            trackId: s.track?.id
          }))
        });
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
      localVideoStreamRef.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.pause();
      remoteVideoRef.current.srcObject = null;
    }

    if (localVideoStreamRef.current) {
      localVideoStreamRef.current.srcObject = null;
    }

    setInVoiceChannel(false);
    setInVideoChannel(false);
    setIsMuted(false);
    setIsVideoMuted(false);
    setRemoteInVoiceChannel(false);
    setRemoteInVideoChannel(false);
    sendMessage({ type: 'voice-leave' });
    sendMessage({ type: 'video-leave' });
    addLog('Left voice and video channel');
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

  const toggleVideoMute = () => {
    if (localVideoStreamRef.current) {
      localVideoStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoMuted(!isVideoMuted);
      addLog(isVideoMuted ? 'Video unmuted' : 'Video muted');
    }
  };

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (localVideoStreamRef.current) {
        localVideoStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.pause();
        remoteAudioRef.current.srcObject = null;
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.pause();
        remoteVideoRef.current.srcObject = null;
      }
      if (localVideoStreamRef.current) {
        localVideoStreamRef.current.srcObject = null;
      }
      if (pcRef.current) {
        pcRef.current.close();
      }
    };
  }, []);

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

  // Ensure local video stream is set when video channel is joined
  useEffect(() => {
    if (inVideoChannel && localVideoStreamRef.current) {
      addLog('Local video stream available in useEffect');
      console.log('Local video stream in useEffect:', localVideoStreamRef.current);
    }
  }, [inVideoChannel]);

  // Monitor remote peer status - removed auto turn off to prevent disconnection issues
  useEffect(() => {
    if (inVoiceChannel && !remoteInVoiceChannel) {
      addLog('Remote peer is not in voice channel');
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
    inVideoChannel,
    remoteInVideoChannel,
    isVideoMuted,
    logs,
    
    // Refs
    pcRef,
    localStreamRef,
    localVideoStreamRef,
    remoteAudioRef,
    remoteVideoRef,
    dataChannelRef,
    
    // Functions
    createDataChannelOffer,
    handleRemoteDescription,
    joinVoiceChannel,
    leaveVoiceChannel,
    toggleMute,
    toggleVideoMute,
    sendMessage,
    addLog,
    handleDataChannelMessage
  };
};
