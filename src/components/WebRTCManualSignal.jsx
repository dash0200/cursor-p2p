import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Copy, Check, Phone, PhoneOff, Volume2 } from 'lucide-react';

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

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const dataChannelRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const isNegotiatingRef = useRef(false);

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

  return (
    <>
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0e7ff 100%)',
        padding: '24px'
      }}>
        <div style={{ maxWidth: '1152px', margin: '0 auto' }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            padding: '24px',
            marginBottom: '24px'
          }}>
            <h1 style={{
              fontSize: '30px',
              fontWeight: 'bold',
              color: '#1f2937',
              marginBottom: '8px'
            }}>
              WebRTC Voice Channel
            </h1>
            <p style={{
              color: '#6b7280',
              marginBottom: '16px'
            }}>
              Discord-style voice channel - join and start talking automatically
            </p>
            
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              marginBottom: '16px',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: connectionState === 'connected' ? '#10b981' :
                                  connectionState === 'connecting' ? '#f59e0b' :
                                  connectionState === 'failed' ? '#ef4444' :
                                  '#d1d5db'
                }} />
                <span style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  {connectionState}
                </span>
              </div>
              {dataChannelRef.current && dataChannelRef.current.readyState === 'open' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2563eb' }}>
                  <div style={{ width: '12px', height: '12px', backgroundColor: '#3b82f6', borderRadius: '50%' }} />
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>Data Channel Open</span>
                </div>
              )}
            </div>
          </div>

        {connectionState !== 'connected' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
            gap: '24px',
            marginBottom: '24px'
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              padding: '24px'
            }}>
              <h2 style={{
                fontSize: '20px',
                fontWeight: '600',
                color: '#1f2937',
                marginBottom: '16px'
              }}>
                Step 1: Create Connection
              </h2>
              
              <button
                onClick={createDataChannelOffer}
                style={{
                  width: '100%',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  fontWeight: '500',
                  border: 'none',
                  cursor: 'pointer',
                  marginBottom: '16px',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#1d4ed8'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#2563eb'}
              >
                Create Offer
              </button>

              {localOffer && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px'
                  }}>
                    <label style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151'
                    }}>
                      Your Offer:
                    </label>
                    <button
                      onClick={() => copyToClipboard(localOffer)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '14px',
                        color: '#2563eb',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                      onMouseOver={(e) => e.target.style.color = '#1d4ed8'}
                      onMouseOut={(e) => e.target.style.color = '#2563eb'}
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <textarea
                    value={localOffer}
                    readOnly
                    style={{
                      width: '100%',
                      height: '128px',
                      padding: '12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      backgroundColor: '#f9fafb',
                      resize: 'none'
                    }}
                  />
                </div>
              )}

              {localAnswer && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px'
                  }}>
                    <label style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151'
                    }}>
                      Your Answer:
                    </label>
                    <button
                      onClick={() => copyToClipboard(localAnswer)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '14px',
                        color: '#2563eb',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                      onMouseOver={(e) => e.target.style.color = '#1d4ed8'}
                      onMouseOut={(e) => e.target.style.color = '#2563eb'}
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <textarea
                    value={localAnswer}
                    readOnly
                    style={{
                      width: '100%',
                      height: '128px',
                      padding: '12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      backgroundColor: '#f9fafb',
                      resize: 'none'
                    }}
                  />
                </div>
              )}
            </div>

            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              padding: '24px'
            }}>
              <h2 style={{
                fontSize: '20px',
                fontWeight: '600',
                color: '#1f2937',
                marginBottom: '16px'
              }}>
                Step 2: Exchange Descriptions
              </h2>
              
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Paste Remote Description:
              </label>
              <textarea
                value={remoteDescription}
                onChange={(e) => setRemoteDescription(e.target.value)}
                placeholder="Paste the offer or answer from the other peer here..."
                style={{
                  width: '100%',
                  height: '128px',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  marginBottom: '16px',
                  resize: 'none'
                }}
              />
              
              <button
                onClick={handleRemoteDescription}
                style={{
                  width: '100%',
                  backgroundColor: '#059669',
                  color: 'white',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  fontWeight: '500',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#047857'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#059669'}
              >
                Process Remote Description
              </button>
            </div>
          </div>
        )}

        {connectionState === 'connected' && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            padding: '24px',
            marginBottom: '24px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '24px'
            }}>
              <h2 style={{
                fontSize: '24px',
                fontWeight: '600',
                color: '#1f2937'
              }}>
                Voice Channel
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: inVoiceChannel ? '#10b981' : '#d1d5db'
                  }} />
                  <span style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151'
                  }}>You</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: remoteInVoiceChannel ? '#10b981' : '#d1d5db'
                  }} />
                  <span style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151'
                  }}>Remote Peer</span>
                </div>
              </div>
            </div>

            <div style={{
              background: 'linear-gradient(90deg, #eef2ff 0%, #f3e8ff 100%)',
              borderRadius: '8px',
              padding: '32px',
              marginBottom: '24px',
              border: '2px solid #c7d2fe'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '24px'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '12px',
                    margin: '0 auto 12px auto',
                    backgroundColor: inVoiceChannel ? '#10b981' : '#d1d5db'
                  }}>
                    <Volume2 style={{ color: 'white' }} size={32} />
                  </div>
                  <p style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151'
                  }}>You</p>
                  <p style={{
                    fontSize: '12px',
                    color: '#6b7280'
                  }}>{inVoiceChannel ? 'Connected' : 'Not in channel'}</p>
                </div>

                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        style={{
                          width: '6px',
                          borderRadius: '9999px',
                          transition: 'all 0.3s ease',
                          height: inVoiceChannel && remoteInVoiceChannel ? '32px' : '16px',
                          backgroundColor: inVoiceChannel && remoteInVoiceChannel ? '#10b981' : '#d1d5db',
                          animation: inVoiceChannel && remoteInVoiceChannel ? 'pulse 1.5s ease-in-out infinite' : 'none',
                          animationDelay: `${i * 0.1}s`
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '12px',
                    margin: '0 auto 12px auto',
                    backgroundColor: remoteInVoiceChannel ? '#10b981' : '#d1d5db'
                  }}>
                    <Volume2 style={{ color: 'white' }} size={32} />
                  </div>
                  <p style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151'
                  }}>Remote Peer</p>
                  <p style={{
                    fontSize: '12px',
                    color: '#6b7280'
                  }}>{remoteInVoiceChannel ? 'Connected' : 'Not in channel'}</p>
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '16px'
            }}>
              {!inVoiceChannel ? (
                <button
                  onClick={joinVoiceChannel}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: '#059669',
                    color: 'white',
                    padding: '12px 32px',
                    borderRadius: '8px',
                    fontWeight: '500',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => e.target.style.backgroundColor = '#047857'}
                  onMouseOut={(e) => e.target.style.backgroundColor = '#059669'}
                >
                  <Phone size={20} />
                  Join Voice Channel
                </button>
              ) : (
                <>
                  <button
                    onClick={toggleMute}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px 24px',
                      borderRadius: '8px',
                      fontWeight: '500',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                      transition: 'background-color 0.2s',
                      backgroundColor: isMuted ? '#dc2626' : '#374151',
                      color: 'white'
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = isMuted ? '#b91c1c' : '#1f2937'}
                    onMouseOut={(e) => e.target.style.backgroundColor = isMuted ? '#dc2626' : '#374151'}
                  >
                    {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                    {isMuted ? 'Unmute' : 'Mute'}
                  </button>
                  <button
                    onClick={leaveVoiceChannel}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: '#dc2626',
                      color: 'white',
                      padding: '12px 24px',
                      borderRadius: '8px',
                      fontWeight: '500',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = '#b91c1c'}
                    onMouseOut={(e) => e.target.style.backgroundColor = '#dc2626'}
                  >
                    <PhoneOff size={20} />
                    Leave Channel
                  </button>
                </>
              )}
            </div>

            <audio ref={remoteAudioRef} autoPlay style={{ display: 'none' }} />
          </div>
        )}

        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          padding: '24px'
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: '600',
            color: '#1f2937',
            marginBottom: '16px'
          }}>
            Connection Log
          </h2>
          <div style={{
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            padding: '16px',
            height: '192px',
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: '12px'
          }}>
            {logs.length === 0 ? (
              <p style={{ color: '#9ca3af' }}>No events yet...</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} style={{ color: '#374151', marginBottom: '4px' }}>
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
        </div>
      </div>
    </>
  );
}