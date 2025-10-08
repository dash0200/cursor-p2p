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
  const [logs, setLogs] = useState([]);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
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
    };

    pc.ontrack = (e) => {
      addLog('Received remote audio track');
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = e.streams[0];
        addLog(`Remote audio stream set. We're in voice: ${inVoiceChannel}, Remote in voice: ${remoteInVoiceChannel}`);
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      stream.getTracks().forEach(track => {
        pcRef.current.addTrack(track, stream);
        addLog(`Added ${track.kind} track to peer connection`);
      });

      setInVoiceChannel(true);
      sendMessage({ type: 'voice-join' });
      addLog('Joined voice channel - audio streaming');

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

    setInVoiceChannel(false);
    setIsMuted(false);
    setRemoteInVoiceChannel(false);
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
      if (remoteAudioRef.current) {
        remoteAudioRef.current.pause();
        remoteAudioRef.current.srcObject = null;
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
    handleDataChannelMessage
  };
};
