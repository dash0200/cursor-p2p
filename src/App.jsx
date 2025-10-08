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
  const [fileTransfers, setFileTransfers] = useState([]) // history entries
  const supportsFS = typeof window !== 'undefined' && 'showSaveFilePicker' in window
  
  // Audio channel state
  const [isInAudioChannel, setIsInAudioChannel] = useState(false)
  const [localAudioStream, setLocalAudioStream] = useState(null)
  const [remoteAudioStream, setRemoteAudioStream] = useState(null)
  const [micActivity, setMicActivity] = useState(false)
  const [micVolume, setMicVolume] = useState(0)
  const [audioChannelReady, setAudioChannelReady] = useState(false)
  
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const iceCandidateBuffer = useRef([])
  const isGatheringComplete = useRef(false)
  const messageIdCounter = useRef(0)
  const incomingFilesRef = useRef(new Map()) // id -> { name, size, chunkSize, receivedBytes, expectedSeq, handle, writable, writer, runningCrc32, lastMeasureTime, lastMeasuredBytes }
  const sendingFilesRef = useRef(new Map()) // id -> { file, chunkSize, reader, offset, seq, runningCrc32, abortController, lastMeasureTime, lastMeasuredBytes, canceled }
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const micActivityIntervalRef = useRef(null)
  const pendingAudioOffersRef = useRef([])
  const pendingAudioAnswersRef = useRef([])
  const pendingAudioIceCandidatesRef = useRef([])
  const audioElementRef = useRef(null)

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
    console.log('🔗 Creating peer connection with audio support')
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
        console.log('🔗 ICE candidate generated:', event.candidate)
        iceCandidateBuffer.current.push(event.candidate)
        setIceCandidates(prev => [...prev, event.candidate])
        
        // Send ICE candidate via data channel if available
        if (dataChannel && dataChannel.readyState === 'open') {
          const iceData = {
            type: 'ice-candidate',
            candidate: event.candidate
          }
          console.log('🔗 Sending ICE candidate via data channel:', iceData)
          dataChannel.send(JSON.stringify(iceData))
        }
      } else {
        console.log('🔗 ICE gathering complete')
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
      console.log('🔗 Connection state:', pc.connectionState)
      if (pc.connectionState === 'connected') {
        setConnectionStatus('connected')
        setAudioChannelReady(true)
        addMessage('system', 'Connection established!')
        console.log('🎵 Audio channel ready for use')
        // Process any pending audio offers/answers when connection is established
        setTimeout(() => {
          processPendingAudioOffers()
          processPendingAudioAnswers()
          processPendingAudioIceCandidates()
        }, 1000) // Small delay to ensure connection is fully stable
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setConnectionStatus('disconnected')
        setAudioChannelReady(false)
        addMessage('system', 'Connection lost')
      } else if (pc.connectionState === 'connecting') {
        setConnectionStatus('connecting')
        setAudioChannelReady(false)
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
      console.log('📡 RECEIVING DATA CHANNEL')
      const channel = event.channel
      setDataChannel(channel)
      setupDataChannel(channel)
    }

    pc.ontrack = (event) => {
      console.log('🎵 RECEIVING REMOTE TRACK', event)
      if (event.track.kind === 'audio') {
        console.log('🎵 Remote audio track received:', event.track)
        console.log('🎵 Remote audio stream:', event.streams[0])
        console.log('🎵 Track state:', event.track.readyState)
        setRemoteAudioStream(event.streams[0])
        attachRemoteAudioToElement(event.streams[0])
        addMessage('system', 'Remote audio stream received')
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
      console.log('📡 DATA CHANNEL OPENED')
      setConnectionStatus('connected')
      addMessage('system', 'Data channel opened - ready to chat!')
      // Process any pending audio offers/answers when data channel opens
      setTimeout(() => {
        processPendingAudioOffers()
        processPendingAudioAnswers()
      }, 500) // Small delay to ensure data channel is fully ready
    }

    channel.onmessage = async (event) => {
      console.log('📨 DATA CHANNEL MESSAGE RECEIVED')
      console.log('📨 MSG RECEIVED - Event data type:', typeof event.data)
      console.log('📨 MSG RECEIVED - Event data:', event.data)
      
      // Binary chunks (ArrayBuffer) for file data
      if (event.data instanceof ArrayBuffer) {
        console.log('📨 Processing binary data (ArrayBuffer)')
        handleIncomingBinaryChunk(event.data)
        return
      }
      // Some browsers deliver as Blob
      if (event.data instanceof Blob) {
        console.log('📨 Processing binary data (Blob)')
        const buf = await event.data.arrayBuffer()
        handleIncomingBinaryChunk(buf)
        return
      }
      // Handle string-based protocol messages (JSON)
      if (typeof event.data === 'string') {
       
        try {
          const data = JSON.parse(event.data)
          console.log('📨 RAW MESSAGE RECEIVED:', event.data)
          console.log('📨 PARSED MESSAGE:', data)
          if (data.type === 'message') {
            console.log('📨 Processing chat message')
            console.log('📨 MSG RECEIVED:', data.message)
            addMessage('remote', data.message)
          } else if (data.type === 'file-offer') {
            // Offer to send a file; receiver chooses save location and replies with accept and start offset
            handleIncomingFileOffer(data)
          } else if (data.type === 'file-accept') {
            // Receiver accepted; begin sending from startOffset
            const { id, startOffset } = data
            const sending = sendingFilesRef.current.get(id)
            if (sending) {
              sending.offset = startOffset || 0
              sending.seq = Math.floor((startOffset || 0) / sending.chunkSize)
              // Start sending
              void sendFileChunks(id)
            }
          } else if (data.type === 'chunk-nack') {
            const { id, seq } = data
            // Retransmit requested chunk
            void retransmitChunk(id, seq)
          } else if (data.type === 'file-complete-ack') {
            const { id, receiverCrc32 } = data
            const sending = sendingFilesRef.current.get(id)
            if (sending) {
              const ok = (sending.runningCrc32 >>> 0) === (receiverCrc32 >>> 0)
              setFileTransfers(prev => prev.map(t => t.id === id ? { ...t, status: ok ? 'completed' : 'checksum_mismatch', progress: 1 } : t))
              if (ok) addMessage('system', `File delivered with checksum verified`)
              sendingFilesRef.current.delete(id)
            }
          } else if (data.type === 'file-cancel') {
            const { id, reason } = data
            // If we are sending this file, stop sending
            const sending = sendingFilesRef.current.get(id)
            if (sending) {
              sending.canceled = true
              try { await sending.reader.cancel(reason || 'remote canceled') } catch (_) {}
              sendingFilesRef.current.delete(id)
            }
            // If we are receiving this file, close writer
            const recv = incomingFilesRef.current.get(id)
            if (recv) {
              try { if (recv.writer) await recv.writer.close() } catch (_) {}
            incomingFilesRef.current.delete(id)
            }
            setFileTransfers(prev => prev.map(t => t.id === id ? { ...t, status: 'canceled' } : t))
            addMessage('system', `Transfer canceled by peer${reason ? `: ${reason}` : ''}`)
          } else if (data.type === 'audio-join') {
            addMessage('system', 'Remote peer joined audio channel')
          } else if (data.type === 'audio-leave') {
            addMessage('system', 'Remote peer left audio channel')
            setRemoteAudioStream(null)
          } else if (data.type === 'audio-offer') {
            console.log('🎵 Received audio offer from remote peer:', data.offer)
            console.log('🎵 Current peerConnection state:', peerConnection ? {
              connectionState: peerConnection.connectionState,
              iceConnectionState: peerConnection.iceConnectionState,
              signalingState: peerConnection.signalingState
            } : 'null')
            
            if (!peerConnection) {
              console.error('🎵 Cannot handle audio offer: peerConnection is null - queuing offer')
              pendingAudioOffersRef.current.push(data.offer)
              addMessage('system', 'Audio offer queued - waiting for connection')
              return
            }
            
            if (peerConnection.connectionState === 'closed' || peerConnection.connectionState === 'failed') {
              console.error('🎵 Cannot handle audio offer: peerConnection is closed or failed - queuing offer')
              pendingAudioOffersRef.current.push(data.offer)
              addMessage('system', 'Audio offer queued - connection not ready')
              return
            }
            
            try {
              await peerConnection.setRemoteDescription(data.offer)
              const answer = await peerConnection.createAnswer()
              await peerConnection.setLocalDescription(answer)
              
              // Send answer back to remote peer
              if (dataChannel && dataChannel.readyState === 'open') {
                const answerData = {
                  type: 'audio-answer',
                  answer: {
                    type: answer.type,
                    sdp: answer.sdp
                  }
                }
                console.log('🎵 Sending audio answer to remote peer:', answerData)
                dataChannel.send(JSON.stringify(answerData))
              }
              
              addMessage('system', 'Audio offer received and answered')
            } catch (error) {
              console.error('🎵 Error handling audio offer:', error)
              addMessage('system', 'Error handling audio offer: ' + error.message)
            }
          } else if (data.type === 'audio-answer') {
            console.log('🎵 Received audio answer from remote peer:', data.answer)
            if (!peerConnection) {
              console.error('🎵 Cannot handle audio answer: peerConnection is null - queuing answer')
              pendingAudioAnswersRef.current.push(data.answer)
              addMessage('system', 'Audio answer queued - waiting for connection')
              return
            }
            
            if (peerConnection.connectionState === 'closed' || peerConnection.connectionState === 'failed') {
              console.error('🎵 Cannot handle audio answer: peerConnection is closed or failed - queuing answer')
              pendingAudioAnswersRef.current.push(data.answer)
              addMessage('system', 'Audio answer queued - connection not ready')
              return
            }
            
            try {
              await peerConnection.setRemoteDescription(data.answer)
              addMessage('system', 'Audio answer received and processed')
            } catch (error) {
              console.error('🎵 Error handling audio answer:', error)
              addMessage('system', 'Error handling audio answer: ' + error.message)
            }
          } else if (data.type === 'ice-candidate') {
            console.log('🔗 Received ICE candidate from remote peer:', data.candidate)
            if (!peerConnection) {
              console.error('🔗 Cannot handle ICE candidate: peerConnection is null - queuing candidate')
              pendingAudioIceCandidatesRef.current.push(data.candidate)
              return
            }
            
            try {
              await peerConnection.addIceCandidate(data.candidate)
              console.log('🔗 ICE candidate added successfully')
            } catch (error) {
              console.error('🔗 Error adding ICE candidate:', error)
            }
          }
        } catch (e) {
          console.log('📨 JSON PARSE ERROR:', e)
          console.log('📨 Raw data that failed to parse:', event.data)
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
      console.log('🧪 SENDING TEST MESSAGE:', testMessage)
      dataChannel.send(JSON.stringify(testMessage))
    } else {
      console.log('🧪 CANNOT SEND TEST - DataChannel state:', dataChannel?.readyState)
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
        ordered: true // reliable by default; removes random stalls from dropped chunks
      })
      console.log('📡 CREATING DATA CHANNEL')
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
      console.log('📤 SENDING CHAT MESSAGE:', messageData)
      dataChannel.send(JSON.stringify(messageData))
      addMessage('local', newMessage.trim())
      setNewMessage('')
    } else {
      console.log('📤 CANNOT SEND CHAT MESSAGE - DataChannel state:', dataChannel?.readyState)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const sendFile = async (file) => {
    if (!dataChannel || dataChannel.readyState !== 'open') return

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const chunkSize = 64 * 1024 // 64KB chunks, binary

    setFileTransfers(prev => ([
      ...prev,
      { id, name: file.name, size: file.size, direction: 'sent', status: 'in_progress', progress: 0, transferred: 0, speedBps: 0 }
    ]))

    // Send offer/metadata first
    dataChannel.send(JSON.stringify({
      type: 'file-offer',
      id, name: file.name, size: file.size, chunkSize
    }))

    // Prepare streaming reader
    const reader = file.stream().getReader()
    sendingFilesRef.current.set(id, {
      file,
      chunkSize,
      reader,
      offset: 0,
      seq: 0,
      runningCrc32: 0 ^ -1,
      abortController: new AbortController(),
      lastMeasureTime: performance.now(),
      lastMeasuredBytes: 0,
      canceled: false
    })
    // Wait for receiver to accept and send startOffset; if none, start at 0 after small grace
    setTimeout(() => {
      const sending = sendingFilesRef.current.get(id)
      if (sending && sending.offset === 0 && sending.seq === 0) {
        void sendFileChunks(id)
      }
    }, 500)
  }

  const downloadFile = (filename, content) => {
    const link = document.createElement('a')
    link.href = content
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // CRC32 utilities for per-chunk and running checksum
  const crc32TableRef = useRef(null)
  const getCrc32Table = () => {
    if (crc32TableRef.current) return crc32TableRef.current
    const table = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
      }
      table[n] = c >>> 0
    }
    crc32TableRef.current = table
    return table
  }
  const computeChunkCrc32 = (crc, bytes) => {
    const table = getCrc32Table()
    let c = crc >>> 0
    for (let i = 0; i < bytes.length; i++) {
      c = table[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8)
    }
    return c >>> 0
  }

  // Binary packet: [1 byte type=1][4 bytes idLen][id utf-8][4 bytes seq][4 bytes chunkLen][4 bytes crc32][payload]
  const makeChunkPacket = (id, seq, payload) => {
    const idBytes = new TextEncoder().encode(id)
    const headerSize = 1 + 4 + idBytes.length + 4 + 4 + 4
    const buffer = new ArrayBuffer(headerSize + payload.byteLength)
    const view = new DataView(buffer)
    const u8 = new Uint8Array(buffer)
    let offset = 0
    view.setUint8(offset, 1); offset += 1
    view.setUint32(offset, idBytes.length, true); offset += 4
    u8.set(idBytes, offset); offset += idBytes.length
    view.setUint32(offset, seq, true); offset += 4
    view.setUint32(offset, payload.byteLength, true); offset += 4
    // crc placeholder; compute over payload only
    const payloadU8 = new Uint8Array(payload)
    const crc = computeChunkCrc32(0 ^ -1, payloadU8) ^ -1
    view.setUint32(offset, crc >>> 0, true); offset += 4
    u8.set(payloadU8, offset)
    return buffer
  }

  const parseChunkPacket = (buffer) => {
    const view = new DataView(buffer)
    const u8 = new Uint8Array(buffer)
    let offset = 0
    const type = view.getUint8(offset); offset += 1
    if (type !== 1) return null
    const idLen = view.getUint32(offset, true); offset += 4
    const id = new TextDecoder().decode(u8.subarray(offset, offset + idLen)); offset += idLen
    const seq = view.getUint32(offset, true); offset += 4
    const len = view.getUint32(offset, true); offset += 4
    const crc = view.getUint32(offset, true); offset += 4
    const payload = u8.subarray(offset, offset + len)
    return { id, seq, crc, payload }
  }

  const waitForBufferLow = () => {
    return new Promise(resolve => {
      const handler = () => {
        dataChannel?.removeEventListener('bufferedamountlow', handler)
        resolve()
      }
      if (dataChannel && dataChannel.bufferedAmount <= (dataChannel.bufferedAmountLowThreshold || 512 * 1024)) return resolve()
      dataChannel?.addEventListener('bufferedamountlow', handler, { once: true })
    })
  }

  const sendFileChunks = async (id) => {
    const sending = sendingFilesRef.current.get(id)
    if (!sending || !dataChannel || dataChannel.readyState !== 'open') return
    const { reader, chunkSize, file } = sending
    const totalBytes = file.size
    // If resuming, skip bytes until reaching offset by reading and discarding
    let toSkip = sending.offset
    while (toSkip > 0) {
      const { done, value } = await reader.read()
      if (done) break
      const skipNow = Math.min(toSkip, value.byteLength)
      toSkip -= skipNow
      if (skipNow < value.byteLength) {
        // Use remaining part of value as first payload
        const firstPayload = value.subarray(skipNow)
        await maybeBackpressure()
        const packet = makeChunkPacket(id, sending.seq, firstPayload)
        dataChannel.send(packet)
        sending.runningCrc32 = computeChunkCrc32(sending.runningCrc32, firstPayload)
        sending.seq += 1
        sending.offset += firstPayload.byteLength
        const now = performance.now()
        const deltaBytes = sending.offset - sending.lastMeasuredBytes
        const deltaMs = Math.max(1, now - sending.lastMeasureTime)
        const speedBps = (deltaBytes * 1000) / deltaMs
        sending.lastMeasuredBytes = sending.offset
        sending.lastMeasureTime = now
        const progress = Math.min(1, sending.offset / totalBytes)
        setFileTransfers(prev => prev.map(t => t.id === id ? { ...t, progress, transferred: sending.offset, speedBps } : t))
        break
      }
    }
    for (;;) {
      if (sending.canceled) break
      const { done, value } = await reader.read()
      if (done) break
      let chunk = value
      let start = 0
      while (start < chunk.byteLength) {
        if (sending.canceled) break
        const end = Math.min(start + chunkSize, chunk.byteLength)
        const slice = chunk.subarray(start, end)
        await maybeBackpressure()
        const packet = makeChunkPacket(id, sending.seq, slice)
        dataChannel.send(packet)
        sending.runningCrc32 = computeChunkCrc32(sending.runningCrc32, slice)
        sending.seq += 1
        sending.offset += slice.byteLength
        const now = performance.now()
        const deltaBytes = sending.offset - sending.lastMeasuredBytes
        const deltaMs = Math.max(1, now - sending.lastMeasureTime)
        const speedBps = (deltaBytes * 1000) / deltaMs
        sending.lastMeasuredBytes = sending.offset
        sending.lastMeasureTime = now
        const progress = Math.min(1, sending.offset / totalBytes)
        setFileTransfers(prev => prev.map(t => t.id === id ? { ...t, progress, transferred: sending.offset, speedBps } : t))
        start = end
      }
    }
    // Completed sending; wait for receiver ack with its crc32
  }

  const maybeBackpressure = async () => {
    if (!dataChannel) return
    if (dataChannel.bufferedAmount > (dataChannel.bufferedAmountLowThreshold || 512 * 1024)) {
      await waitForBufferLow()
    }
  }

  const retransmitChunk = async (id, seq) => {
    const sending = sendingFilesRef.current.get(id)
    if (!sending) return
    // Re-read specific chunk from file by slicing
    const start = seq * sending.chunkSize
    const end = Math.min(start + sending.chunkSize, sending.file.size)
    const blob = sending.file.slice(start, end)
    const buf = new Uint8Array(await blob.arrayBuffer())
    await maybeBackpressure()
    const packet = makeChunkPacket(id, seq, buf)
    dataChannel.send(packet)
  }

  const handleIncomingBinaryChunk = async (buffer) => {
    const parsed = parseChunkPacket(buffer)
    if (!parsed) return
    const { id, seq, crc, payload } = parsed
    const entry = incomingFilesRef.current.get(id)
    if (!entry) return
    const computed = (computeChunkCrc32(0 ^ -1, payload) ^ -1) >>> 0
    if (computed !== (crc >>> 0)) {
      // Request retransmit
      dataChannel?.send(JSON.stringify({ type: 'chunk-nack', id, seq }))
      return
    }
    // Enforce order by seq
    const expectedSeq = entry.expectedSeq || 0
    if (seq !== expectedSeq) {
      // With reliable ordered channel, out-of-order shouldn't happen; request retransmit if gap
      if (seq > expectedSeq) {
        dataChannel?.send(JSON.stringify({ type: 'chunk-nack', id, seq: expectedSeq }))
      }
      return
    }
    // Write to file stream, or accumulate in-memory fallback
    if (entry.writer) {
      await entry.writer.write(payload)
    } else if (entry.writable && entry.writable.write) {
      await entry.writable.write(payload)
    } else {
      if (!entry.buffers) entry.buffers = []
      // Ensure we store a copy
      entry.buffers.push(new Uint8Array(payload))
    }
    entry.receivedBytes += payload.byteLength
    entry.expectedSeq = expectedSeq + 1
    entry.runningCrc32 = computeChunkCrc32(entry.runningCrc32, payload)
    const now = performance.now()
    if (!entry.lastMeasureTime) entry.lastMeasureTime = now
    if (typeof entry.lastMeasuredBytes !== 'number') entry.lastMeasuredBytes = entry.receivedBytes
    const deltaBytes = entry.receivedBytes - entry.lastMeasuredBytes
    const deltaMs = Math.max(1, now - entry.lastMeasureTime)
    const speedBps = (deltaBytes * 1000) / deltaMs
    entry.lastMeasuredBytes = entry.receivedBytes
    entry.lastMeasureTime = now
    const progress = Math.min(1, entry.receivedBytes / entry.size)
    setFileTransfers(prev => prev.map(t => t.id === id ? { ...t, progress, transferred: entry.receivedBytes, speedBps } : t))
    if (entry.receivedBytes >= entry.size) {
      // Close stream and send ack with checksum
      try {
        if (entry.writer) await entry.writer.close()
        if (entry.writable && entry.writable.close) await entry.writable.close()
      } catch (_) {}
      const receiverCrc32 = (entry.runningCrc32 ^ -1) >>> 0
      dataChannel?.send(JSON.stringify({ type: 'file-complete-ack', id, receiverCrc32 }))
      // If we used in-memory fallback, download now
      if (!entry.writer && !(entry.writable && entry.writable.close) && entry.buffers && entry.buffers.length) {
        const blob = new Blob(entry.buffers, { type: 'application/octet-stream' })
        const url = URL.createObjectURL(blob)
        downloadFile(entry.name, url)
      }
      setFileTransfers(prev => prev.map(t => t.id === id ? { ...t, status: 'completed', progress: 1 } : t))
      addMessage('system', `File received: ${entry.name}`)
      incomingFilesRef.current.delete(id)
    }
  }

  const handleIncomingFileOffer = async ({ id, name, size, chunkSize }) => {
    try {
      let startOffset = 0
      let handle = null
      let writer = null
      let runningCrc32 = 0 ^ -1
      if (supportsFS) {
        try {
          handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'All Files', accept: { '*/*': ['.*'] } }] })
          // Determine resume offset if file exists
          const file = await handle.getFile().catch(() => null)
          startOffset = file ? Math.min(file.size, size) : 0
          const stream = await handle.createWritable({ keepExistingData: true })
          if (startOffset > 0) await stream.seek(startOffset)
          writer = stream
        } catch (e) {
          // User cancelled; fall back to in-memory and auto-download on complete
        }
      }
      incomingFilesRef.current.set(id, {
        name,
        size,
        chunkSize,
        receivedBytes: startOffset,
        expectedSeq: Math.floor(startOffset / chunkSize),
        handle,
        writable: writer,
        writer,
        runningCrc32,
        lastMeasureTime: performance.now(),
        lastMeasuredBytes: startOffset
      })
      setFileTransfers(prev => ([
        ...prev,
        { id, name, size, direction: 'received', status: 'in_progress', progress: (startOffset / size) || 0, transferred: startOffset, speedBps: 0 }
      ]))
      // Tell sender where to start
      dataChannel?.send(JSON.stringify({ type: 'file-accept', id, startOffset }))
    } catch (e) {
      addMessage('system', `File offer failed: ${e.message}`)
    }
  }

  const cancelTransfer = async (id, reason = 'canceled by user') => {
    // Sender side
    const sending = sendingFilesRef.current.get(id)
    if (sending) {
      sending.canceled = true
      try { await sending.reader.cancel(reason) } catch (_) {}
      sendingFilesRef.current.delete(id)
    }
    // Receiver side
    const recv = incomingFilesRef.current.get(id)
    if (recv) {
      try { if (recv.writer) await recv.writer.close() } catch (_) {}
      incomingFilesRef.current.delete(id)
    }
    // Inform peer
    try { dataChannel?.send(JSON.stringify({ type: 'file-cancel', id, reason })) } catch (_) {}
    setFileTransfers(prev => prev.map(t => t.id === id ? { ...t, status: 'canceled' } : t))
    addMessage('system', `Transfer canceled${reason ? `: ${reason}` : ''}`)
  }

  const formatBytes = (bytes = 0) => {
    if (bytes < 1024) return `${bytes} B`
    const units = ['KB','MB','GB','TB']
    let i = -1
    do { bytes = bytes / 1024; i++ } while (bytes >= 1024 && i < units.length - 1)
    return `${bytes.toFixed(1)} ${units[i]}`
  }

  const formatSpeed = (bps = 0) => `${formatBytes(bps)}/s`

  const disconnect = () => {
    // Clean up audio resources
    if (isInAudioChannel) {
      leaveAudioChannel()
    }
    
    // Clear pending audio offers/answers/ICE candidates
    pendingAudioOffersRef.current = []
    pendingAudioAnswersRef.current = []
    pendingAudioIceCandidatesRef.current = []
    
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

  // Audio channel functions
  const isPeerConnectionReady = () => {
    return peerConnection && 
           peerConnection.connectionState !== 'closed' && 
           peerConnection.connectionState !== 'failed' &&
           dataChannel && 
           dataChannel.readyState === 'open'
  }

  const processPendingAudioOffers = async () => {
    if (!isPeerConnectionReady()) return

    console.log('🎵 Processing pending audio offers:', pendingAudioOffersRef.current.length)
    
    while (pendingAudioOffersRef.current.length > 0) {
      const offer = pendingAudioOffersRef.current.shift()
      try {
        console.log('🎵 Processing pending audio offer:', offer)
        await peerConnection.setRemoteDescription(offer)
        const answer = await peerConnection.createAnswer()
        await peerConnection.setLocalDescription(answer)
        
        // Send answer back to remote peer
        if (dataChannel && dataChannel.readyState === 'open') {
          const answerData = {
            type: 'audio-answer',
            answer: {
              type: answer.type,
              sdp: answer.sdp
            }
          }
          console.log('🎵 Sending audio answer to remote peer:', answerData)
          dataChannel.send(JSON.stringify(answerData))
        }
        
        addMessage('system', 'Pending audio offer processed')
      } catch (error) {
        console.error('🎵 Error processing pending audio offer:', error)
        addMessage('system', 'Error processing pending audio offer: ' + error.message)
      }
    }
  }

  const processPendingAudioAnswers = async () => {
    if (!isPeerConnectionReady()) return

    console.log('🎵 Processing pending audio answers:', pendingAudioAnswersRef.current.length)
    
    while (pendingAudioAnswersRef.current.length > 0) {
      const answer = pendingAudioAnswersRef.current.shift()
      try {
        console.log('🎵 Processing pending audio answer:', answer)
        await peerConnection.setRemoteDescription(answer)
        addMessage('system', 'Pending audio answer processed')
      } catch (error) {
        console.error('🎵 Error processing pending audio answer:', error)
        addMessage('system', 'Error processing pending audio answer: ' + error.message)
      }
    }
  }

  const processPendingAudioIceCandidates = async () => {
    if (!isPeerConnectionReady()) return

    console.log('🔗 Processing pending ICE candidates:', pendingAudioIceCandidatesRef.current.length)
    
    while (pendingAudioIceCandidatesRef.current.length > 0) {
      const candidate = pendingAudioIceCandidatesRef.current.shift()
      try {
        console.log('🔗 Processing pending ICE candidate:', candidate)
        await peerConnection.addIceCandidate(candidate)
      } catch (error) {
        console.error('🔗 Error processing pending ICE candidate:', error)
      }
    }
  }

  const attachRemoteAudioToElement = (stream) => {
    console.log('🎵 Attaching remote audio stream to element:', stream)
    
    if (audioElementRef.current) {
      audioElementRef.current.srcObject = stream
      audioElementRef.current.autoplay = true
      audioElementRef.current.muted = false
      audioElementRef.current.volume = 1.0
      
      audioElementRef.current.play().catch(e => {
        console.log('🎵 Audio autoplay failed, will retry on user interaction:', e)
        // Try to play after user interaction
        const playOnInteraction = () => {
          audioElementRef.current.play().then(() => {
            console.log('🎵 Remote audio started playing after user interaction')
            document.removeEventListener('click', playOnInteraction)
            document.removeEventListener('touchstart', playOnInteraction)
          }).catch(err => {
            console.log('🎵 Remote audio play failed after interaction:', err)
          })
        }
        document.addEventListener('click', playOnInteraction, { once: true })
        document.addEventListener('touchstart', playOnInteraction, { once: true })
      })
    }
  }

  const joinAudioChannel = async () => {
    console.log('🎵 Attempting to join audio channel')
    
    // Check if peer connection is ready
    if (!isPeerConnectionReady()) {
      console.error('🎵 Cannot join audio channel: peer connection not ready')
      addMessage('system', 'Cannot join audio channel: peer connection not ready')
      return
    }

    try {
      // Request microphone permission
      console.log('🎵 Requesting microphone access')
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      })
      
      console.log('🎵 Microphone access granted, stream:', stream)
      setLocalAudioStream(stream)
      setIsInAudioChannel(true)
      
      // Add audio track to peer connection
      const audioTrack = stream.getAudioTracks()[0]
      console.log('🎵 Adding audio track to peer connection:', audioTrack)
      peerConnection.addTrack(audioTrack, stream)
      
      // Create new offer to include audio track
      console.log('🎵 Creating audio offer')
      const offer = await peerConnection.createOffer()
      await peerConnection.setLocalDescription(offer)
      
      // Send the new offer to remote peer via data channel
      if (dataChannel && dataChannel.readyState === 'open') {
        const offerData = {
          type: 'audio-offer',
          offer: {
            type: offer.type,
            sdp: offer.sdp
          }
        }
        console.log('🎵 Sending audio offer to remote peer:', offerData)
        dataChannel.send(JSON.stringify(offerData))
      }
      
      // Set up microphone activity monitoring
      setupMicActivityMonitoring(stream)
      
      // Notify remote peer
      if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify({ type: 'audio-join' }))
      }
      
      addMessage('system', 'Joined audio channel - microphone active')
      console.log('🎵 Successfully joined audio channel')
      
    } catch (error) {
      console.error('🎵 Error joining audio channel:', error)
      addMessage('system', 'Failed to join audio channel: ' + error.message)
      
      // Clean up on error
      if (localAudioStream) {
        localAudioStream.getTracks().forEach(track => track.stop())
        setLocalAudioStream(null)
        setIsInAudioChannel(false)
      }
    }
  }

  const leaveAudioChannel = () => {
    console.log('🎵 Leaving audio channel')
    
    // Stop local audio stream
    if (localAudioStream) {
      console.log('🎵 Stopping local audio stream')
      localAudioStream.getTracks().forEach(track => track.stop())
      setLocalAudioStream(null)
    }
    
    // Remove audio track from peer connection
    if (peerConnection) {
      console.log('🎵 Removing audio track from peer connection')
      const senders = peerConnection.getSenders()
      senders.forEach(sender => {
        if (sender.track && sender.track.kind === 'audio') {
          peerConnection.removeTrack(sender)
        }
      })
    }
    
    // Stop mic activity monitoring
    if (micActivityIntervalRef.current) {
      clearInterval(micActivityIntervalRef.current)
      micActivityIntervalRef.current = null
    }
    
    // Clean up audio context
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    
    // Clear remote audio stream
    setRemoteAudioStream(null)
    if (audioElementRef.current) {
      audioElementRef.current.srcObject = null
    }
    
    setIsInAudioChannel(false)
    setMicActivity(false)
    setMicVolume(0)
    
    // Notify remote peer
    if (dataChannel && dataChannel.readyState === 'open') {
      dataChannel.send(JSON.stringify({ type: 'audio-leave' }))
    }
    
    addMessage('system', 'Left audio channel')
    console.log('🎵 Successfully left audio channel')
  }

  const setupMicActivityMonitoring = (stream) => {
    try {
      // Create audio context for analyzing microphone input
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
      analyserRef.current = audioContextRef.current.createAnalyser()
      
      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)
      
      analyserRef.current.fftSize = 256
      const bufferLength = analyserRef.current.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      
      // Monitor microphone activity and volume
      micActivityIntervalRef.current = setInterval(() => {
        analyserRef.current.getByteFrequencyData(dataArray)
        
        // Calculate average volume
        let sum = 0
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i]
        }
        const average = sum / bufferLength
        
        // Normalize volume to 0-100 scale
        const normalizedVolume = Math.min(100, (average / 255) * 100)
        setMicVolume(normalizedVolume)
        
        // Consider activity if average volume is above threshold
        const isActive = average > 10
        setMicActivity(isActive)
      }, 100)
      
    } catch (error) {
      console.error('Error setting up mic activity monitoring:', error)
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
        fileTransfers={fileTransfers}
        sendFile={sendFile}
        cancelTransfer={cancelTransfer}
        formatBytes={formatBytes}
        formatSpeed={formatSpeed}
        disconnect={disconnect}
        addMessage={addMessage}
        // Audio props
        isInAudioChannel={isInAudioChannel}
        joinAudioChannel={joinAudioChannel}
        leaveAudioChannel={leaveAudioChannel}
        localAudioStream={localAudioStream}
        remoteAudioStream={remoteAudioStream}
        micActivity={micActivity}
        micVolume={micVolume}
        isPeerConnectionReady={isPeerConnectionReady}
        audioElementRef={audioElementRef}
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
                <h3>Transfer History</h3>
                {fileTransfers.length === 0 ? (
                  <p style={{ color: '#a0a0a0' }}>No transfers yet.</p>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {fileTransfers.map(t => (
                      <li key={t.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid #2a2a2a' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>{t.name}</div>
                            <div style={{ fontSize: '0.8rem', color: '#a0a0a0' }}>
                              {t.direction === 'sent' ? 'Sent' : 'Received'} • {formatBytes(t.size)}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#a0a0a0' }}>
                              {formatBytes(t.transferred || 0)} / {formatBytes(t.size)}
                              {typeof t.speedBps === 'number' && t.status === 'in_progress' ? ` • ${formatSpeed(t.speedBps)}` : ''}
                          </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                            <span>{Math.round((t.progress || 0) * 100)}% {t.status}</span>
                            {t.status === 'in_progress' && (
                              <button className="neumorphic-btn danger" onClick={() => cancelTransfer(t.id)}>Cancel</button>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
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
