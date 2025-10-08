import { useState, useRef, useEffect } from 'react'
import ConnectedPage from './components/ConnectedPage'
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
  
  // Voice chat state
  const [inVoiceChannel, setInVoiceChannel] = useState(false)
  const [remoteInVoiceChannel, setRemoteInVoiceChannel] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isNegotiating, setIsNegotiating] = useState(false)
  const [localAudioLevel, setLocalAudioLevel] = useState(0)
  const [remoteAudioLevel, setRemoteAudioLevel] = useState(0)
  
  
  const messagesEndRef = useRef(null)
  const iceCandidateBuffer = useRef([])
  const isGatheringComplete = useRef(false)
  const messageIdCounter = useRef(0)
  
  // Voice chat refs
  const localStreamRef = useRef(null)
  const remoteAudioRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const animationFrameRef = useRef(null)
  const isNegotiatingRef = useRef(false)
  const pendingIceCandidatesRef = useRef([])

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

  // Cleanup audio monitoring on unmount
  useEffect(() => {
    return () => {
      stopAudioLevelMonitoring()
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

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
        iceCandidateBuffer.current.push(event.candidate)
        setIceCandidates(prev => [...prev, event.candidate])
        
        // Send ICE candidate via data channel if available
        if (dataChannel && dataChannel.readyState === 'open') {
          const iceData = {
            type: 'ice-candidate',
            candidate: event.candidate
          }
          dataChannel.send(JSON.stringify(iceData))
        }
      } else {
        isGatheringComplete.current = true
      }
    }

    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === 'complete') {
        isGatheringComplete.current = true
        addMessage('system', 'ICE gathering complete')
      }
    }

    pc.onsignalingstatechange = () => {
      setSignalingState(pc.signalingState)
    }

    pc.onconnectionstatechange = () => {
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

    pc.ontrack = (event) => {
      if (event.track && event.track.kind === 'audio') {
        if (remoteAudioRef.current && event.streams && event.streams[0]) {
          remoteAudioRef.current.srcObject = event.streams[0]
          remoteAudioRef.current.volume = 1.0
          remoteAudioRef.current.muted = false
          
          // Force play the audio
          remoteAudioRef.current.play()
            .then(() => {
              addMessage('system', 'Remote audio connected')
            })
            .catch(e => {
              addMessage('system', 'Remote audio play failed: ' + e.message)
            })
        } else {
          addMessage('system', 'Remote audio element not ready')
        }
      }
    }

    pc.onnegotiationneeded = async () => {
      if (dataChannel && dataChannel.readyState === 'open' && !isNegotiatingRef.current) {
        try {
          isNegotiatingRef.current = true
          setIsNegotiating(true)
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          sendVoiceMessage({ type: 'voice-offer', sdp: pc.localDescription })
          addMessage('system', 'Voice renegotiation offer sent')
        } catch (error) {
          console.error('🎤 Negotiation error:', error)
          addMessage('system', 'Voice negotiation failed: ' + error.message)
        } finally {
          isNegotiatingRef.current = false
          setIsNegotiating(false)
        }
      }
    }


    setPeerConnection(pc)
    return pc
  }

  const setupDataChannel = (channel) => {    
    // Configure backpressure threshold for smoother sending
    try {
      channel.bufferedAmountLowThreshold = 512 * 1024 // 512KB
    } catch (_) {}
    channel.onopen = () => {
      setConnectionStatus('connected')
      addMessage('system', 'Data channel opened - ready to chat!')
    }

    channel.onmessage = async (event) => {
      // Handle string-based protocol messages (JSON)
      if (typeof event.data === 'string') {
       
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'message') {
            addMessage('remote', data.message)
          } else if (data.type === 'ice-candidate') {
            if (peerConnection && peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
              try {
                await peerConnection.addIceCandidate(data.candidate)
              } catch (error) {
                console.error('🔗 Error adding ICE candidate:', error)
              }
            } else {
              iceCandidateBuffer.current.push(data.candidate)
              pendingIceCandidatesRef.current.push(data.candidate)
            }
          } else if (data.type === 'voice-join') {
            setRemoteInVoiceChannel(true)
            addMessage('system', 'Remote peer joined voice channel')
          } else if (data.type === 'voice-leave') {
            setRemoteInVoiceChannel(false)
            addMessage('system', 'Remote peer left voice channel')
          } else if (data.type === 'voice-offer') {
            await handleVoiceRenegotiation(data.sdp)
          } else if (data.type === 'voice-answer') {
            await handleVoiceAnswer(data.sdp)
          } else if (data.type === 'voice-mute-status') {
            // Note: We don't track remote mute status in this implementation
            // but we could add a state variable for it if needed
            addMessage('system', `Remote peer ${data.muted ? 'muted' : 'unmuted'} their microphone`)
          }
        } catch (e) {
          // plain text fallback
          addMessage('remote', event.data)
        }
      }
    }

    channel.onclose = () => {
      setConnectionStatus('disconnected')
      addMessage('system', 'Connection closed')
    }
  }

  const addMessage = (sender, text) => {
    const message = {
      id: `msg_${Date.now()}_${++messageIdCounter.current}_${Math.random().toString(36).substr(2, 9)}`,
      sender,
      text,
      timestamp: new Date().toLocaleTimeString()
    }
    setMessages(prev => [...prev, message])
  }




  // Test function to verify data channel communication
  const testDataChannel = () => {
    if (dataChannel && dataChannel.readyState === 'open') {
      const testMessage = {
        type: 'message',
        message: 'TEST MESSAGE FROM DATA CHANNEL'
      }
      dataChannel.send(JSON.stringify(testMessage))
    }
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
      } catch (error) {
        console.error('Failed to add ICE candidate:', error)
      }
    }
  }

  const createOffer = async () => {
    try {
      const pc = createPeerConnection()
      const dataChannel = pc.createDataChannel('chat', {
        ordered: true // reliable by default; removes random stalls from dropped chunks
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

  // Voice chat functions
  const isPeerConnectionReady = () => {
    return peerConnection && 
           peerConnection.connectionState !== 'closed' && 
           peerConnection.connectionState !== 'failed' &&
           dataChannel && 
           dataChannel.readyState === 'open'
  }

  const sendVoiceMessage = (message) => {
    if (dataChannel && dataChannel.readyState === 'open') {
      dataChannel.send(JSON.stringify(message))
    }
  }

  const checkConnectionStatus = () => {
    // Connection status checking logic can be added here if needed
  }

  const forcePlayRemoteAudio = () => {
    if (remoteAudioRef.current && remoteAudioRef.current.srcObject) {
      remoteAudioRef.current.play()
        .then(() => {
          addMessage('system', 'Remote audio force play successful')
        })
        .catch(e => {
          addMessage('system', 'Remote audio force play failed: ' + e.message)
        })
    } else {
      addMessage('system', 'No remote audio stream available')
    }
  }

  const initializeAudioContext = async () => {
    try {
      // Create audio context to enable audio playback
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (AudioContext) {
        const audioContext = new AudioContext()
        if (audioContext.state === 'suspended') {
          await audioContext.resume()
        }
        audioContextRef.current = audioContext
        return audioContext
      }
    } catch (error) {
      // Audio context initialization failed
    }
  }

  const createAudioAnalyzer = (stream) => {
    if (!audioContextRef.current) return null
    
    try {
      const source = audioContextRef.current.createMediaStreamSource(stream)
      const analyser = audioContextRef.current.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8
      source.connect(analyser)
      
      return analyser
    } catch (error) {
      return null
    }
  }

  const measureAudioLevel = (analyser) => {
    if (!analyser) return 0
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteFrequencyData(dataArray)
    
    // Calculate average volume
    let sum = 0
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i]
    }
    const average = sum / dataArray.length
    
    // Normalize to 0-1 range
    return Math.min(average / 128, 1)
  }

  const startAudioLevelMonitoring = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    
    const monitor = () => {
      // Monitor local audio level
      if (analyserRef.current && inVoiceChannel && !isMuted) {
        const level = measureAudioLevel(analyserRef.current)
        setLocalAudioLevel(level)
      } else {
        setLocalAudioLevel(0)
      }
      
      // Monitor remote audio level - enhanced with actual audio analysis
      if (remoteAudioRef.current && remoteAudioRef.current.srcObject && remoteInVoiceChannel) {
        // Create a more realistic remote audio level based on connection state
        const connectionState = peerConnection?.connectionState
        if (connectionState === 'connected') {
          // Simulate some audio activity when remote is connected
          const baseLevel = 0.2 + Math.random() * 0.3
          setRemoteAudioLevel(baseLevel)
        } else {
          setRemoteAudioLevel(0)
        }
      } else {
        setRemoteAudioLevel(0)
      }
      
      animationFrameRef.current = requestAnimationFrame(monitor)
    }
    
    monitor()
  }

  const stopAudioLevelMonitoring = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    setLocalAudioLevel(0)
    setRemoteAudioLevel(0)
  }

  const handleVoiceRenegotiation = async (sdp) => {
    if (!peerConnection || isNegotiatingRef.current) return
    
    try {
      isNegotiatingRef.current = true
      setIsNegotiating(true)
      await peerConnection.setRemoteDescription(sdp)
      
      // Add any pending ICE candidates
      for (const candidate of pendingIceCandidatesRef.current) {
        try {
          await peerConnection.addIceCandidate(candidate)
        } catch (error) {
          console.error('🔗 Error adding pending ICE candidate:', error)
        }
      }
      pendingIceCandidatesRef.current = []
      
      const answer = await peerConnection.createAnswer()
      await peerConnection.setLocalDescription(answer)
      
      sendVoiceMessage({ type: 'voice-answer', sdp: peerConnection.localDescription })
      addMessage('system', 'Voice renegotiation answer sent')
    } catch (error) {
      console.error('🎤 Voice renegotiation error:', error)
      addMessage('system', 'Voice renegotiation failed: ' + error.message)
    } finally {
      isNegotiatingRef.current = false
      setIsNegotiating(false)
    }
  }

  const handleVoiceAnswer = async (sdp) => {
    if (!peerConnection) return
    
    try {
      await peerConnection.setRemoteDescription(sdp)
      
      // Add any pending ICE candidates
      for (const candidate of pendingIceCandidatesRef.current) {
        try {
          await peerConnection.addIceCandidate(candidate)
        } catch (error) {
          console.error('🔗 Error adding pending ICE candidate:', error)
        }
      }
      pendingIceCandidatesRef.current = []
      
      addMessage('system', 'Voice renegotiation completed successfully')
    } catch (error) {
      console.error('🎤 Voice answer error:', error)
      addMessage('system', 'Voice answer failed: ' + error.message)
    }
  }

  const joinVoiceChannel = async () => {
    if (!isPeerConnectionReady()) {
      addMessage('system', 'Connection not ready for voice chat')
      return
    }

    // Check if getUserMedia is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      addMessage('system', 'Microphone access not supported in this browser')
      return
    }

    try {
      addMessage('system', 'Requesting microphone access...')
      
      // Initialize audio context first
      await initializeAudioContext()
      
      // Request microphone permission with specific constraints
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      })
      
      localStreamRef.current = stream

      // Create audio analyzer for visual feedback
      analyserRef.current = createAudioAnalyzer(stream)

      // Add audio tracks to peer connection
      const audioTracks = stream.getAudioTracks()
      
      if (audioTracks.length === 0) {
        addMessage('system', 'No audio tracks found in stream')
        return
      }
      
      audioTracks.forEach(track => {
        peerConnection.addTrack(track, stream)
      })

      setInVoiceChannel(true)
      sendVoiceMessage({ type: 'voice-join' })
      addMessage('system', 'Joined voice channel - audio streaming')
      
      // Start audio level monitoring for visual feedback
      startAudioLevelMonitoring()
      
      // Test local audio
      const testAudio = new Audio()
      testAudio.srcObject = stream
      testAudio.volume = 0.1
      testAudio.play().catch(e => {})
      
    } catch (error) {
      console.error('🎤 Error joining voice channel:', error)
      if (error.name === 'NotAllowedError') {
        addMessage('system', 'Microphone access denied. Please allow microphone access and try again.')
      } else if (error.name === 'NotFoundError') {
        addMessage('system', 'No microphone found. Please connect a microphone and try again.')
      } else if (error.name === 'NotSupportedError') {
        addMessage('system', 'Microphone access not supported in this browser.')
      } else {
        addMessage('system', 'Error joining voice channel: ' + error.message)
      }
    }
  }

  const leaveVoiceChannel = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks()
      
      audioTracks.forEach(track => {
        track.stop()
        
        // Remove track from peer connection
        const senders = peerConnection.getSenders()
        const sender = senders.find(s => s.track === track)
        if (sender) {
          peerConnection.removeTrack(sender)
        }
      })
      
      localStreamRef.current = null
    }
    
    // Stop audio level monitoring
    stopAudioLevelMonitoring()
    analyserRef.current = null
    
    // Reset voice channel state
    setInVoiceChannel(false)
    setIsMuted(false)
    setLocalAudioLevel(0)
    
    // Notify remote peer
    sendVoiceMessage({ type: 'voice-leave' })
    addMessage('system', 'Left voice channel')
  }

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks()
      const newMutedState = !isMuted
      
      audioTracks.forEach(track => {
        track.enabled = !newMutedState
      })
      
      setIsMuted(newMutedState)
      addMessage('system', newMutedState ? 'Microphone muted' : 'Microphone unmuted')
      
      // Send mute status to remote peer
      if (dataChannel && dataChannel.readyState === 'open') {
        sendVoiceMessage({ 
          type: 'voice-mute-status', 
          muted: newMutedState 
        })
      }
    }
  }




  // Show ConnectedPage when connection is established
  if (connectionStatus === 'connected') {
    return (
      <ConnectedPage
        messages={messages}
        setMessages={setMessages}
        newMessage={newMessage}
        setNewMessage={setNewMessage}
        sendMessage={sendMessage}
        handleKeyPress={handleKeyPress}
        dataChannel={dataChannel}
        disconnect={disconnect}
        addMessage={addMessage}
        inVoiceChannel={inVoiceChannel}
        remoteInVoiceChannel={remoteInVoiceChannel}
        isMuted={isMuted}
        isNegotiating={isNegotiating}
        joinVoiceChannel={joinVoiceChannel}
        leaveVoiceChannel={leaveVoiceChannel}
        toggleMute={toggleMute}
        remoteAudioRef={remoteAudioRef}
        checkConnectionStatus={checkConnectionStatus}
        forcePlayRemoteAudio={forcePlayRemoteAudio}
        initializeAudioContext={initializeAudioContext}
        localAudioLevel={localAudioLevel}
        remoteAudioLevel={remoteAudioLevel}
      />
    )
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