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
  addMessage,
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
}) {
  const [currentVideo, setCurrentVideo] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const videoRef = useRef(null)

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
            addMessage={addMessage}
          />
        )}
      </div>
      
      {/* Hidden audio element for remote audio */}
      <audio 
        ref={remoteAudioRef} 
        autoPlay 
        playsInline
        controls={false}
        muted={false}
        volume={1.0}
        style={{ display: 'none' }} 
        onLoadedMetadata={() => {
          console.log('🎤 Remote audio metadata loaded')
          if (remoteAudioRef.current) {
            remoteAudioRef.current.play().catch(e => console.log('Auto-play failed:', e))
          }
        }}
        onCanPlay={() => {
          console.log('🎤 Remote audio can play')
          if (remoteAudioRef.current) {
            remoteAudioRef.current.play().catch(e => console.log('Can-play auto-play failed:', e))
          }
        }}
      />
    </div>
  )
}

export default ConnectedPage
