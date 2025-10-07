import { useRef, useEffect, useState } from 'react'

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
  disconnect
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
            className={`tab-btn ${activeTab === 'files' ? 'active' : ''}`}
            onClick={() => setActiveTab('files')}
          >
            Files
          </button>
        </div>
        <div className="header-actions">
          <div className="connection-indicator">
            <div className="status-dot connected"></div>
            <span>Connected</span>
          </div>
          <button 
            className="disconnect-btn"
            onClick={disconnect}
            title="Disconnect"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
