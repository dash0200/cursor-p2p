import { useState, useRef } from 'react'
import VideoPlayer from './VideoPlayer'
import ChatSidebar from './ChatSidebar'
import './ConnectedPage.css'

function ConnectedPage({
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
  sendVideoSync,
  videoSyncHandlersRef,
  flushPendingSyncEvents,
  addMessage
}) {
  const [currentVideo, setCurrentVideo] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [videoCallActive, setVideoCallActive] = useState(false)
  const [videoCallStatus, setVideoCallStatus] = useState('Ready to call')
  const videoRef = useRef(null)
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const peerConnectionRef = useRef(null)

  const handleVideoLoad = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
    }
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleSeek = (time) => {
    console.log('🎬 ConnectedPage handleSeek called with time:', time)
    if (videoRef.current) {
      videoRef.current.currentTime = time
      setCurrentTime(time)
      console.log('🎬 Video currentTime set to:', time)
    } else {
      console.log('🎬 ERROR: videoRef.current not available')
    }
  }

  const toggleSidebar = () => {
    setSidebarVisible(!sidebarVisible)
  }

  const startVideoCall = async () => {
    try {
      setVideoCallStatus('Starting call...')
      
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      })
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }
      
      // Create peer connection
      const peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      })
      
      peerConnectionRef.current = peerConnection
      
      // Add local stream to peer connection
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream)
      })
      
      // Handle remote stream
      peerConnection.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0]
        }
      }
      
      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && dataChannel) {
          dataChannel.send(JSON.stringify({
            type: 'video_call_ice',
            candidate: event.candidate
          }))
        }
      }
      
      // Create offer
      const offer = await peerConnection.createOffer()
      await peerConnection.setLocalDescription(offer)
      
      // Send offer through data channel
      if (dataChannel) {
        dataChannel.send(JSON.stringify({
          type: 'video_call_offer',
          offer: offer
        }))
      }
      
      setVideoCallActive(true)
      setVideoCallStatus('Call in progress')
      addMessage('system', '🎥 Video call started')
      
    } catch (error) {
      console.error('Error starting video call:', error)
      setVideoCallStatus('Failed to start call')
      addMessage('system', '❌ Failed to start video call')
    }
  }

  const endVideoCall = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
    
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null
    }
    
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null
    }
    
    setVideoCallActive(false)
    setVideoCallStatus('Call ended')
    addMessage('system', '🎥 Video call ended')
    
    // Notify remote peer
    if (dataChannel) {
      dataChannel.send(JSON.stringify({
        type: 'video_call_end'
      }))
    }
  }

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="connected-page">
      {/* Main Content Area */}
      <div className="main-content">
        
        {/* Video Player Section */}
        <div className={`video-section ${!sidebarVisible ? 'full-width' : ''}`}>
        {sidebarVisible && (
          <button 
            className="sidebar-toggle hide-btn"
            onClick={toggleSidebar}
            title="Hide Sidebar"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
        )}
          <VideoPlayer
            videoRef={videoRef}
            currentVideo={currentVideo}
            setCurrentVideo={setCurrentVideo}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            currentTime={currentTime}
            duration={duration}
            handleVideoLoad={handleVideoLoad}
            handleTimeUpdate={handleTimeUpdate}
            togglePlayPause={togglePlayPause}
            handleSeek={handleSeek}
            formatTime={formatTime}
            sendVideoSync={sendVideoSync}
            videoSyncHandlersRef={videoSyncHandlersRef}
            flushPendingSyncEvents={flushPendingSyncEvents}
            addMessage={addMessage}
          />
        </div>

        {/* Sidebar Toggle Button */}
        

        {/* Show Sidebar Button (when hidden) */}
        {!sidebarVisible && (
          <button 
            className="sidebar-toggle show-btn"
            onClick={toggleSidebar}
            title="Show Sidebar"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
        )}
        

        {/* Right Sidebar with Chat */}
        {sidebarVisible && (
          <ChatSidebar
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
            videoCallActive={videoCallActive}
            videoCallStatus={videoCallStatus}
            startVideoCall={startVideoCall}
            endVideoCall={endVideoCall}
            localVideoRef={localVideoRef}
            remoteVideoRef={remoteVideoRef}
          />
        )}
      </div>
    </div>
  )
}

export default ConnectedPage
