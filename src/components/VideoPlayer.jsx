import { useState, useEffect, useRef } from 'react'

function VideoPlayer({
  videoRef,
  currentVideo,
  setCurrentVideo,
  isPlaying,
  setIsPlaying,
  currentTime,
  duration,
  handleVideoLoad,
  handleTimeUpdate,
  togglePlayPause,
  handleSeek,
  formatTime,
}) {
  const [volume, setVolume] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(false)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const videoContainerRef = useRef(null)

  // Helper function to format time in readable format
  const formatTimeReadable = (timeInSeconds) => {
    const hours = Math.floor(timeInSeconds / 3600)
    const minutes = Math.floor((timeInSeconds % 3600) / 60)
    const seconds = timeInSeconds % 60
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds.toFixed(1)}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds.toFixed(1)}s`
    } else {
      return `${seconds.toFixed(1)}s`
    }
  }


  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    if (videoRef.current) {
      videoRef.current.volume = newVolume
    }
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoRef.current?.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const handleVideoSelect = (e) => {
    const file = e.target.files[0]
    if (file && file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file)
      setCurrentVideo(url)
      if (videoRef.current) {
        videoRef.current.src = url
        videoRef.current.load()
      }
    }
  }

  const triggerVideoSelect = () => {
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = 'video/*'
    fileInput.onchange = handleVideoSelect
    fileInput.click()
  }

  // Handle mouse movement to show/hide controls
  const handleMouseMove = (e) => {
    if (!videoContainerRef.current) return
    
    const rect = videoContainerRef.current.getBoundingClientRect()
    const mouseY = e.clientY - rect.top
    const containerHeight = rect.height
    
    // Show controls when mouse is in bottom 20% of video
    const shouldShowControls = mouseY > containerHeight * 0.8
    
    setShowControls(shouldShowControls)
    setMousePosition({ x: e.clientX - rect.left, y: mouseY })
  }

  const handleMouseLeave = () => {
    setShowControls(false)
  }

  // Keyboard controls
  const handleKeyDown = (e) => {
    if (!currentVideo || !videoRef.current) return

    // Prevent default behavior for these keys
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.code)) {
      e.preventDefault()
    }

    switch (e.code) {
      case 'Space':
        handleTogglePlayPause()
        break
      case 'ArrowUp':
        const newVolumeUp = Math.min(1, volume + 0.1)
        setVolume(newVolumeUp)
        videoRef.current.volume = newVolumeUp
        break
      case 'ArrowDown':
        const newVolumeDown = Math.max(0, volume - 0.1)
        setVolume(newVolumeDown)
        videoRef.current.volume = newVolumeDown
        break
      case 'ArrowLeft':
        const seekLeft = Math.max(0, currentTime - 10)
        handleSeek(seekLeft)
        break
      case 'ArrowRight':
        const seekRight = Math.min(duration, currentTime + 10)
        handleSeek(seekRight)
        break
      default:
        break
    }
  }

  // Add keyboard event listener
  useEffect(() => {
    if (currentVideo) {
      document.addEventListener('keydown', handleKeyDown)
      return () => {
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [currentVideo, volume, currentTime, duration, togglePlayPause])


  // Toggle play/pause
  const handleTogglePlayPause = () => {
    togglePlayPause()
  }


  return (
    <div className="video-player">
      <div 
        className="video-container"
        ref={videoContainerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {currentVideo ? (
          <video
            ref={videoRef}
            className="main-video"
            onLoadedMetadata={handleVideoLoad}
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onClick={handleTogglePlayPause}
          >
            <source src={currentVideo} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        ) : (
          <div className="no-video-placeholder">
            <div className="placeholder-content">
              <div className="placeholder-icon">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M23 7l-7 5 7 5V7z"></path>
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                </svg>
              </div>
              <h3>No Video Selected</h3>
              <p>Choose a video file to start watching</p>
              <label className="video-upload-btn">
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleVideoSelect}
                  style={{ display: 'none' }}
                />
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7,10 12,15 17,10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Select Video
              </label>
            </div>
          </div>
        )}

        {/* Keyboard Controls Help */}
        {currentVideo && showControls && (
          <div className="keyboard-help">
            <div className="help-text">
              <span>Space: Play/Pause</span>
              <span>↑↓: Volume</span>
              <span>←→: Seek</span>
            </div>
          </div>
        )}

        {/* Video Overlay Controls */}
        {currentVideo && showControls && (
          <div className="video-overlay">
            <div className="video-controls">
              <button 
                className="control-btn play-pause"
                onClick={handleTogglePlayPause}
                title={isPlaying ? 'Pause' : 'Play'}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {isPlaying ? (
                    <>
                      <rect x="6" y="4" width="4" height="16"></rect>
                      <rect x="14" y="4" width="4" height="16"></rect>
                    </>
                  ) : (
                    <polygon points="5,3 19,12 5,21"></polygon>
                  )}
                </svg>
              </button>

              <div className="time-display">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>

              <div className="progress-container" onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const clickX = e.clientX - rect.left
                const percentage = clickX / rect.width
                const newTime = percentage * duration
                handleSeek(newTime)
              }}>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
                  ></div>
                </div>
              </div>

              <div className="volume-control">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                </svg>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="volume-slider"
                />
              </div>

              <button 
                className="control-btn select-video"
                onClick={triggerVideoSelect}
                title="Select New Video"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7,10 12,15 17,10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
              </button>

              <button 
                className="control-btn fullscreen"
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {isFullscreen ? (
                    <>
                      <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>
                    </>
                  ) : (
                    <>
                      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                    </>
                  )}
                </svg>
              </button>

            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default VideoPlayer
