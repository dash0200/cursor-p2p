import { useState, useRef, useEffect } from 'react'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('connect')
  const [connectionStatus, setConnectionStatus] = useState('disconnected') // disconnected, connecting, connected
  const [localOffer, setLocalOffer] = useState('')
  const [remoteOffer, setRemoteOffer] = useState('')
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [peerConnection, setPeerConnection] = useState(null)
  const [dataChannel, setDataChannel] = useState(null)
  const [toast, setToast] = useState(null) // { message, type }
  const [copiedOffer, setCopiedOffer] = useState(false)
  const [copiedAnswer, setCopiedAnswer] = useState(false)
  const [connectionMode, setConnectionMode] = useState('create') // 'create' or 'join'
  const [iceCandidates, setIceCandidates] = useState([])
  const [remoteIceCandidates, setRemoteIceCandidates] = useState([])
  const [signalingState, setSignalingState] = useState('stable')
  
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const iceCandidateBuffer = useRef([])
  const isGatheringComplete = useRef(false)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Toast auto-hide
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 1800)
    return () => clearTimeout(t)
  }, [toast])

  const copyToClipboard = async (text, which) => {
    try {
      await navigator.clipboard.writeText(text)
      if (which === 'offer') {
        setCopiedOffer(true)
        setTimeout(() => setCopiedOffer(false), 700)
      } else if (which === 'answer') {
        setCopiedAnswer(true)
        setTimeout(() => setCopiedAnswer(false), 700)
      }
      setToast({ message: 'Copied to clipboard', type: 'success' })
    } catch (e) {
      setToast({ message: 'Copy failed', type: 'error' })
    }
  }

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    })

    // Reset ICE candidate tracking
    iceCandidateBuffer.current = []
    isGatheringComplete.current = false

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('ICE candidate generated:', event.candidate)
        iceCandidateBuffer.current.push(event.candidate)
        setIceCandidates(prev => [...prev, event.candidate])
      } else {
        console.log('ICE gathering complete')
        isGatheringComplete.current = true
      }
    }

    pc.onicegatheringstatechange = () => {
      console.log('ICE gathering state:', pc.iceGatheringState)
      if (pc.iceGatheringState === 'complete') {
        isGatheringComplete.current = true
        addMessage('system', 'ICE gathering complete')
      }
    }

    pc.onsignalingstatechange = () => {
      console.log('Signaling state:', pc.signalingState)
      setSignalingState(pc.signalingState)
    }

    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState)
      if (pc.connectionState === 'connected') {
        setConnectionStatus('connected')
        addMessage('system', 'Connection established!')
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setConnectionStatus('disconnected')
        addMessage('system', 'Connection lost')
      } else if (pc.connectionState === 'connecting') {
        setConnectionStatus('connecting')
        addMessage('system', 'Connecting...')
      }
    }

    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState)
      if (pc.iceConnectionState === 'connected') {
        setConnectionStatus('connected')
        addMessage('system', 'ICE connection established!')
      } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        setConnectionStatus('disconnected')
        addMessage('system', 'ICE connection lost')
      } else if (pc.iceConnectionState === 'checking') {
        addMessage('system', 'Checking ICE connectivity...')
      }
    }

    pc.ondatachannel = (event) => {
      const channel = event.channel
      setDataChannel(channel)
      setupDataChannel(channel)
    }

    setPeerConnection(pc)
    return pc
  }

  const setupDataChannel = (channel) => {
    channel.onopen = () => {
      setConnectionStatus('connected')
      addMessage('system', 'Data channel opened - ready to chat!')
    }

    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'message') {
          addMessage('remote', data.message)
        } else if (data.type === 'file') {
          addMessage('system', `File received: ${data.filename}`)
          // Handle file download
          downloadFile(data.filename, data.content)
        }
      } catch (e) {
        addMessage('remote', event.data)
      }
    }

    channel.onclose = () => {
      setConnectionStatus('disconnected')
      addMessage('system', 'Connection closed')
    }
  }

  const addMessage = (sender, text) => {
    const message = {
      id: Date.now(),
      sender,
      text,
      timestamp: new Date().toLocaleTimeString()
    }
    setMessages(prev => [...prev, message])
  }

  // Helper function to wait for ICE gathering to complete
  const waitForIceGathering = (pc, timeout = 10000) => {
    return new Promise((resolve, reject) => {
      if (pc.iceGatheringState === 'complete') {
        resolve(pc.localDescription)
        return
      }

      const timeoutId = setTimeout(() => {
        reject(new Error('ICE gathering timeout'))
      }, timeout)

      const checkGatheringState = () => {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timeoutId)
          resolve(pc.localDescription)
        } else {
          setTimeout(checkGatheringState, 100)
        }
      }

      checkGatheringState()
    })
  }

  // Helper function to add ICE candidates to peer connection
  const addIceCandidates = async (pc, candidates) => {
    for (const candidate of candidates) {
      try {
        await pc.addIceCandidate(candidate)
        console.log('Added ICE candidate:', candidate)
      } catch (error) {
        console.error('Failed to add ICE candidate:', error)
      }
    }
  }

  const createOffer = async () => {
    try {
      const pc = createPeerConnection()
      const dataChannel = pc.createDataChannel('chat', {
        ordered: true,
        maxRetransmits: 3
      })
      setDataChannel(dataChannel)
      setupDataChannel(dataChannel)

      addMessage('system', 'Creating offer...')
      
      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
        voiceActivityDetection: false
      })
      
      await pc.setLocalDescription(offer)
      addMessage('system', 'Offer created, gathering ICE candidates...')
      
      // Wait for ICE gathering to complete
      const offerWithCandidates = await waitForIceGathering(pc)
      
      // Create a complete offer object with ICE candidates
      const completeOffer = {
        type: offerWithCandidates.type,
        sdp: offerWithCandidates.sdp,
        iceCandidates: iceCandidateBuffer.current
      }
      
      setLocalOffer(JSON.stringify(completeOffer))
      setConnectionStatus('connecting')
      setConnectionMode('waiting')
      addMessage('system', 'Offer with ICE candidates ready. Share it with the other peer.')
    } catch (error) {
      console.error('Error creating offer:', error)
      addMessage('system', 'Error creating offer: ' + error.message)
    }
  }

  const joinWithOffer = async () => {
    if (!remoteOffer.trim()) {
      addMessage('system', 'Please paste the offer first')
      return
    }

    try {
      const pc = createPeerConnection()
      const offerData = JSON.parse(remoteOffer.trim())
      
      addMessage('system', 'Processing offer...')
      
      // Set remote description
      const offer = {
        type: offerData.type,
        sdp: offerData.sdp
      }
      await pc.setRemoteDescription(offer)
      
      // Add ICE candidates if they exist
      if (offerData.iceCandidates && offerData.iceCandidates.length > 0) {
        addMessage('system', `Adding ${offerData.iceCandidates.length} ICE candidates...`)
        await addIceCandidates(pc, offerData.iceCandidates)
      }
      
      addMessage('system', 'Creating answer...')
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      
      addMessage('system', 'Answer created, gathering ICE candidates...')
      
      // Wait for ICE gathering to complete
      const answerWithCandidates = await waitForIceGathering(pc)
      
      // Create a complete answer object with ICE candidates
      const completeAnswer = {
        type: answerWithCandidates.type,
        sdp: answerWithCandidates.sdp,
        iceCandidates: iceCandidateBuffer.current
      }
      
      setLocalOffer(JSON.stringify(completeAnswer))
      setConnectionStatus('connecting')
      setConnectionMode('answer')
      addMessage('system', 'Answer with ICE candidates ready. Share it with the other peer.')
    } catch (error) {
      console.error('Error accepting offer:', error)
      addMessage('system', 'Error accepting offer: ' + error.message)
    }
  }

  const completeConnection = async () => {
    if (!remoteOffer.trim()) {
      addMessage('system', 'Please paste the answer first')
      return
    }

    try {
      const answerData = JSON.parse(remoteOffer.trim())
      
      addMessage('system', 'Processing answer...')
      
      // Set remote description
      const answer = {
        type: answerData.type,
        sdp: answerData.sdp
      }
      await peerConnection.setRemoteDescription(answer)
      
      // Add ICE candidates if they exist
      if (answerData.iceCandidates && answerData.iceCandidates.length > 0) {
        addMessage('system', `Adding ${answerData.iceCandidates.length} ICE candidates...`)
        await addIceCandidates(peerConnection, answerData.iceCandidates)
      }
      
      addMessage('system', 'Answer accepted. Establishing connection...')
      
      // Set a timeout for connection
      const connectionTimeout = setTimeout(() => {
        if (peerConnection.connectionState !== 'connected') {
          addMessage('system', 'Connection timeout. Please check your network and try again.')
        }
      }, 15000)
      
      // Clear timeout if connection succeeds
      const checkConnection = () => {
        if (peerConnection.connectionState === 'connected') {
          clearTimeout(connectionTimeout)
        } else if (peerConnection.connectionState === 'failed') {
          clearTimeout(connectionTimeout)
          addMessage('system', 'Connection failed. Please try again.')
        } else {
          setTimeout(checkConnection, 1000)
        }
      }
      checkConnection()
      
    } catch (error) {
      console.error('Error accepting answer:', error)
      addMessage('system', 'Error accepting answer: ' + error.message)
    }
  }

  const sendMessage = () => {
    if (newMessage.trim() && dataChannel && dataChannel.readyState === 'open') {
      const messageData = {
        type: 'message',
        message: newMessage.trim()
      }
      dataChannel.send(JSON.stringify(messageData))
      addMessage('local', newMessage.trim())
      setNewMessage('')
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const sendFile = (file) => {
    if (dataChannel && dataChannel.readyState === 'open') {
      const reader = new FileReader()
      reader.onload = () => {
        const fileData = {
          type: 'file',
          filename: file.name,
          content: reader.result,
          size: file.size
        }
        dataChannel.send(JSON.stringify(fileData))
        addMessage('system', `File sent: ${file.name}`)
      }
      reader.readAsDataURL(file)
    }
  }

  const downloadFile = (filename, content) => {
    const link = document.createElement('a')
    link.href = content
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const disconnect = () => {
    if (peerConnection) {
      peerConnection.close()
      setPeerConnection(null)
    }
    if (dataChannel) {
      dataChannel.close()
      setDataChannel(null)
    }
    setConnectionStatus('disconnected')
    setLocalOffer('')
    setRemoteOffer('')
    setConnectionMode('create')
    setQrCode('')
    setIceCandidates([])
    setRemoteIceCandidates([])
    setSignalingState('stable')
    iceCandidateBuffer.current = []
    isGatheringComplete.current = false
    addMessage('system', 'Disconnected')
  }

  const resetConnection = () => {
    disconnect()
    setMessages([])
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1 className="logo">P2P Chat</h1>
          <div className="connection-status">
            <div className={`status-indicator ${connectionStatus}`}></div>
            <span className="status-text">{connectionStatus}</span>
          </div>
          <nav className="nav">
            <button 
              className={activeTab === 'connect' ? 'nav-btn active' : 'nav-btn'}
              onClick={() => setActiveTab('connect')}
            >
              Connect
            </button>
            <button 
              className={activeTab === 'chat' ? 'nav-btn active' : 'nav-btn'}
              onClick={() => setActiveTab('chat')}
              disabled={connectionStatus !== 'connected'}
            >
              Chat
            </button>
            <button 
              className={activeTab === 'files' ? 'nav-btn active' : 'nav-btn'}
              onClick={() => setActiveTab('files')}
              disabled={connectionStatus !== 'connected'}
            >
              Files
            </button>
          </nav>
        </div>
      </header>

      <main className="main">
        {activeTab === 'connect' && (
          <div className="connect">
            <h2>Peer-to-Peer Connection</h2>
            
            {connectionStatus === 'disconnected' && connectionMode === 'create' && (
              <div className="connection-options">
                <div className="option-card">
                  <h3>Create New Connection</h3>
                  <p>Start a new connection and share the offer with another peer</p>
                  <button className="neumorphic-btn primary" onClick={createOffer}>
                    Create Offer
                  </button>
                </div>
                
                <div className="option-card">
                  <h3>Join Existing Connection</h3>
                  <p>Paste an offer from another peer to join their connection</p>
                  <textarea 
                    value={remoteOffer}
                    onChange={(e) => setRemoteOffer(e.target.value)}
                    placeholder="Paste the offer here..."
                    className="offer-textarea"
                  />
                  <button 
                    className="neumorphic-btn primary" 
                    onClick={joinWithOffer}
                    disabled={!remoteOffer.trim()}
                  >
                    Join Connection
                  </button>
                </div>
              </div>
            )}

            {connectionMode === 'waiting' && localOffer && (
              <div className="waiting-section">
                <h3>Share Your Offer</h3>
                <p>Share this offer with the other peer and wait for their answer:</p>
                
                <div className="offer-display">
                  <textarea 
                    value={localOffer}
                    readOnly
                    className="offer-textarea"
                    onClick={(e) => e.target.select()}
                  />
                  <button 
                    className={`neumorphic-btn secondary copy-btn ${copiedOffer ? 'copied' : ''}`}
                    onClick={() => copyToClipboard(localOffer, 'offer')}
                  >
                    {copiedOffer ? 'Copied!' : 'Copy to Clipboard'}
                  </button>
                </div>

                <div className="answer-input">
                  <h4>Paste Answer Here:</h4>
                  <textarea 
                    value={remoteOffer}
                    onChange={(e) => setRemoteOffer(e.target.value)}
                    placeholder="Paste the answer from the other peer here..."
                    className="offer-textarea"
                  />
                  <button 
                    className="neumorphic-btn primary" 
                    onClick={completeConnection}
                    disabled={!remoteOffer.trim()}
                  >
                    Complete Connection
                  </button>
                </div>
              </div>
            )}

            {connectionMode === 'answer' && localOffer && (
              <div className="answer-section">
                <h3>Share Your Answer</h3>
                <p>Share this answer with the other peer to complete the connection:</p>
                
                <div className="offer-display">
                  <textarea 
                    value={localOffer}
                    readOnly
                    className="offer-textarea"
                    onClick={(e) => e.target.select()}
                  />
                  <button 
                    className={`neumorphic-btn secondary copy-btn ${copiedAnswer ? 'copied' : ''}`}
                    onClick={() => copyToClipboard(localOffer, 'answer')}
                  >
                    {copiedAnswer ? 'Copied!' : 'Copy to Clipboard'}
                  </button>
                </div>
              </div>
            )}

            {(connectionStatus === 'connected' || connectionStatus === 'connecting') && (
              <div className="connection-actions">
                <button className="neumorphic-btn danger" onClick={resetConnection}>
                  {connectionStatus === 'connected' ? 'Disconnect & Reset' : 'Cancel & Reset'}
                </button>
              </div>
            )}

            {/* Connection Status Display */}
            {(connectionStatus === 'connecting' || connectionMode !== 'create') && (
              <div className="connection-status-display">
                <div className="status-item">
                  <span className="status-label">Connection:</span>
                  <span className={`status-value ${connectionStatus}`}>{connectionStatus}</span>
                </div>
                <div className="status-item">
                  <span className="status-label">Signaling:</span>
                  <span className="status-value">{signalingState}</span>
                </div>
                <div className="status-item">
                  <span className="status-label">ICE Candidates:</span>
                  <span className="status-value">{iceCandidates.length}</span>
                </div>
                {peerConnection && (
                  <div className="status-item">
                    <span className="status-label">ICE State:</span>
                    <span className="status-value">{peerConnection.iceConnectionState}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="chat">
            <h2>Chat</h2>
            <div className="chat-container">
              <div className="messages-container">
                {messages.map(message => (
                  <div key={message.id} className={`message ${message.sender}`}>
                    <div className="message-content">
                      <span className="message-text">{message.text}</span>
                      <span className="message-time">{message.timestamp}</span>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              
              <div className="message-input-container">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  className="message-input"
                  rows="3"
                />
                <button 
                  className="neumorphic-btn primary send-btn"
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                >
                  Send
                </button>
              </div>
            </div>
      </div>
        )}

        {activeTab === 'files' && (
          <div className="files">
            <h2>File Sharing</h2>
            <div className="file-container">
              <div className="file-upload-section">
                <h3>Send File</h3>
                <div className="file-upload-area">
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files[0]
                      if (file) {
                        sendFile(file)
                        e.target.value = ''
                      }
                    }}
                    style={{ display: 'none' }}
                  />
                  <button 
                    className="neumorphic-btn primary"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose File
        </button>
                  <p>Click to select a file to send</p>
                </div>
              </div>
              
              <div className="file-info">
                <h3>File Transfer Info</h3>
                <ul>
                  <li>Files are sent directly between peers</li>
                  <li>No server storage or processing</li>
                  <li>Maximum file size depends on browser limits</li>
                  <li>Files are automatically downloaded by the recipient</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>
      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.message}
        </div>
      )}
      </div>
  )
}

export default App
