import { useRef, useEffect, useState } from 'react'

// ChatSidebar component with audio channel support
function ChatSidebar({ 
  messages, 
  setMessages, 
  newMessage, 
  setNewMessage, 
  sendMessage, 
  handleKeyPress,
  dataChannel,
  fileTransfers,
  sendFile,
  cancelTransfer,
  formatBytes,
  formatSpeed,
  disconnect,
  inVoiceChannel,
  remoteInVoiceChannel,
  isMuted,
  isNegotiating,
  joinVoiceChannel,
  leaveVoiceChannel,
  toggleMute,
  remoteAudioRef,
  checkConnectionStatus,
  forcePlayRemoteAudio,
  initializeAudioContext,
  localAudioLevel,
  remoteAudioLevel,
  addMessage,
}) {
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const [activeTab, setActiveTab] = useState('chat')

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      sendFile(file)
      e.target.value = ''
    }
  }

  return (
    <div className="chat-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-tabs">
          <button 
            className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            Chat
          </button>
          <button 
            className={`tab-btn ${activeTab === 'voice' ? 'active' : ''}`}
            onClick={() => setActiveTab('voice')}
          >
            Voice
          </button>
          <button 
            className={`tab-btn ${activeTab === 'files' ? 'active' : ''}`}
            onClick={() => setActiveTab('files')}
          >
            Files
          </button>
        </div>
        <div className="header-actions">
          <div className="connection-indicator subtle">
            <div className="status-dot connected"></div>
            
          </div>
          <button 
            className="disconnect-btn subtle"
            onClick={disconnect}
            title="Disconnect"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path>
              <line x1="23" y1="1" x2="1" y2="23"></line>
            </svg>
          </button>
        </div>
      </div>
      
      <div className="sidebar-content">
        {activeTab === 'chat' && (
          <>
            <div className="chat-messages">
              {messages.map(message => (
                <div key={message.id} className={`message-container ${message.sender}`}>
                  <div className="message-bubble">
                    <div className="bubble-content">
                      <span className="message-text">{message.text}</span>
                    </div>
                  </div>
                  <div className="message-timestamp">
                    {message.timestamp}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            
            <div className="chat-input-container">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                className="chat-input"
                rows="1"
              />
              <button 
                className="send-button"
                onClick={sendMessage}
                disabled={!newMessage.trim() || !dataChannel || dataChannel.readyState !== 'open'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22,2 15,22 11,13 2,9"></polygon>
                </svg>
              </button>
            </div>
          </>
        )}

        {activeTab === 'voice' && (
          <div className="voice-content">
            {/* Voice Channel Header */}
            <div className="voice-channel-header">
              <div className="channel-info">
                <div className="channel-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line x1="12" y1="19" x2="12" y2="23"></line>
                    <line x1="8" y1="23" x2="16" y2="23"></line>
                  </svg>
                </div>
                <div className="channel-details">
                  <h3 className="channel-name">General Voice</h3>
                  <p className="channel-description">
                    {inVoiceChannel || remoteInVoiceChannel ? 
                      `${inVoiceChannel && remoteInVoiceChannel ? '2' : '1'} member${inVoiceChannel && remoteInVoiceChannel ? 's' : ''} in voice` : 
                      'No one is in voice'
                    }
                  </p>
                </div>
              </div>
              <div className="channel-status">
                <div className={`status-indicator ${inVoiceChannel || remoteInVoiceChannel ? 'active' : 'inactive'}`}>
                  <div className="status-dot"></div>
                </div>
              </div>
            </div>

            {/* Voice Visualization */}
            <div className="voice-visualization">
              <div className="visualization-container">
                <div className="participant-visual">
                  <div className={`participant-avatar ${inVoiceChannel ? 'connected' : 'disconnected'}`}>
                    <div className="avatar-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                    </div>
                    {inVoiceChannel && localAudioLevel > 0.1 && (
                      <div className="speaking-indicator">
                        <div className="speaking-ring"></div>
                      </div>
                    )}
                  </div>
                  <div className="participant-info">
                    <span className="participant-name">You</span>
                    <span className={`participant-status ${inVoiceChannel ? 'connected' : 'disconnected'}`}>
                      {inVoiceChannel ? (isMuted ? 'Muted' : (localAudioLevel > 0.1 ? 'Speaking' : 'Connected')) : 'Not connected'}
                    </span>
                  </div>
                </div>

                {/* Audio Visualization Bars */}
                <div className="audio-visualization">
                  {[...Array(8)].map((_, i) => (
                    <div
                      key={i}
                      className={`viz-bar ${inVoiceChannel && localAudioLevel > (i + 1) * 0.125 ? 'active' : ''}`}
                      style={{
                        height: `${Math.max(8, localAudioLevel * 40 + Math.random() * 10)}px`,
                        animationDelay: `${i * 0.05}s`
                      }}
                    />
                  ))}
                </div>

                <div className="participant-visual">
                  <div className={`participant-avatar ${remoteInVoiceChannel ? 'connected' : 'disconnected'}`}>
                    <div className="avatar-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                    </div>
                    {remoteInVoiceChannel && remoteAudioLevel > 0.1 && (
                      <div className="speaking-indicator">
                        <div className="speaking-ring"></div>
                      </div>
                    )}
                  </div>
                  <div className="participant-info">
                    <span className="participant-name">Remote Peer</span>
                    <span className={`participant-status ${remoteInVoiceChannel ? 'connected' : 'disconnected'}`}>
                      {remoteInVoiceChannel ? (remoteAudioLevel > 0.1 ? 'Speaking' : 'Connected') : 'Not connected'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Voice Controls */}
            <div className="voice-controls">
              {!inVoiceChannel ? (
                <button 
                  className="voice-btn join-btn"
                  onClick={joinVoiceChannel}
                  disabled={!dataChannel || dataChannel.readyState !== 'open' || isNegotiating}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path>
                  </svg>
                  Join Voice Channel
                </button>
              ) : (
                <div className="voice-controls-group">
                  <button 
                    className={`voice-btn ${isMuted ? 'mute-btn' : 'unmute-btn'}`}
                    onClick={toggleMute}
                    disabled={isNegotiating}
                    title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                  >
                    {isMuted ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                        <line x1="23" y1="9" x2="17" y2="15"></line>
                        <line x1="17" y1="9" x2="23" y2="15"></line>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                      </svg>
                    )}
                    {isMuted ? 'Unmute' : 'Mute'}
                  </button>
                  
                  <button 
                    className="voice-btn leave-btn"
                    onClick={leaveVoiceChannel}
                    disabled={isNegotiating}
                    title="Leave voice channel"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path>
                      <line x1="23" y1="1" x2="1" y2="23"></line>
                    </svg>
                    Leave Channel
                  </button>
                </div>
              )}
            </div>

            {isNegotiating && (
              <div className="negotiation-status">
                <div className="negotiation-spinner"></div>
                <span>Negotiating voice connection...</span>
              </div>
            )}

            {/* Debug section */}
            <div className="voice-debug">
              <h4 style={{ color: '#e0e0e0', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Debug Tools</h4>
              <button 
                className="voice-btn test-audio-btn"
                onClick={async () => {
                  try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
                    
                    const audio = new Audio()
                    audio.srcObject = stream
                    audio.volume = 0.5
                    audio.muted = false
                    await audio.play()
                    addMessage('system', 'Microphone test successful - you should hear yourself')
                  } catch (error) {
                    console.error('🎤 Test audio failed:', error)
                    addMessage('system', 'Microphone test failed: ' + error.message)
                  }
                }}
              >
                Test Microphone
              </button>
              
              <button 
                className="voice-btn test-audio-btn"
                onClick={() => {
                  
                  addMessage('system', 'Check console for browser compatibility info')
                }}
                style={{ marginTop: '0.5rem' }}
              >
                Check Browser Support
              </button>
              
              <button 
                className="voice-btn test-audio-btn"
                onClick={() => {
                  checkConnectionStatus()
                  addMessage('system', 'Check console for connection status')
                }}
                style={{ marginTop: '0.5rem' }}
              >
                Check Connection Status
              </button>
              
              <button 
                className="voice-btn test-audio-btn"
                onClick={() => {
                  forcePlayRemoteAudio()
                }}
                style={{ marginTop: '0.5rem' }}
              >
                Force Play Remote Audio
              </button>
              
              <button 
                className="voice-btn test-audio-btn"
                onClick={async () => {
                  await initializeAudioContext()
                  addMessage('system', 'Audio context initialized')
                }}
                style={{ marginTop: '0.5rem' }}
              >
                Initialize Audio Context
              </button>
            </div>
          </div>
        )}

        {activeTab === 'files' && (
          <div className="files-content">
            <div className="file-upload-section">
              <button 
                className="upload-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={!dataChannel || dataChannel.readyState !== 'open'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7,10 12,15 17,10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Upload File
              </button>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </div>

            <div className="transfer-history">
              <h4>Transfer History</h4>
              {fileTransfers.length === 0 ? (
                <div className="no-transfers">
                  <p>No file transfers yet</p>
                </div>
              ) : (
                <div className="transfers-list">
                  {fileTransfers.map(transfer => (
                    <div key={transfer.id} className="transfer-item">
                      <div className="transfer-info">
                        <div className="transfer-name">{transfer.name}</div>
                        <div className="transfer-details">
                          <span className="transfer-direction">
                            {transfer.direction === 'sent' ? 'Sent' : 'Received'}
                          </span>
                          <span className="transfer-size">{formatBytes(transfer.size)}</span>
                        </div>
                        <div className="transfer-progress">
                          <div className="progress-bar">
                            <div 
                              className="progress-fill" 
                              style={{ width: `${(transfer.progress || 0) * 100}%` }}
                            ></div>
                          </div>
                          <span className="progress-text">
                            {Math.round((transfer.progress || 0) * 100)}%
                          </span>
                        </div>
                        {transfer.status === 'in_progress' && (
                          <div className="transfer-speed">
                            {formatSpeed(transfer.speedBps)}
                          </div>
                        )}
                      </div>
                      <div className="transfer-actions">
                        {transfer.status === 'in_progress' && (
                          <button 
                            className="cancel-btn"
                            onClick={() => cancelTransfer(transfer.id)}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="18" y1="6" x2="6" y2="18"></line>
                              <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                          </button>
                        )}
                        <div className={`transfer-status ${transfer.status}`}>
                          {transfer.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}


      </div>
    </div>
  )
}

export default ChatSidebar
