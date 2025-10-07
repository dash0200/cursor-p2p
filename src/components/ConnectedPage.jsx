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
  flushPendingSyncEvents
}) {
  const [currentVideo, setCurrentVideo] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
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
        <div className="video-section">
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
          />
        </div>

        {/* Right Sidebar with Chat */}
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
        />
      </div>
    </div>
  )
}

export default ConnectedPage
