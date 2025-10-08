import React from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Upload } from 'lucide-react';

const VideoPlayer = ({
  videoRef,
  fileInputRef,
  videoFile,
  isPlaying,
  currentTime,
  duration,
  volume,
  isVideoMuted,
  dataChannelReady,
  handleVideoFileSelect,
  togglePlayPause,
  handleSeek,
  handleVolumeChange,
  toggleVideoMute,
  toggleFullscreen,
  formatTime
}) => {
  return (
    <div className="video-player-container">
      <div className="video-player-wrapper">
        <video
          ref={videoRef}
          className="video-player"
          poster=""
          onClick={togglePlayPause}
          src={videoFile ? videoRef.current?.src || null : null}
        >
          Your browser does not support the video tag.
        </video>

        {!videoFile && (
          <div className="video-placeholder">
            <div className="video-placeholder-content">
              <h3 className="video-placeholder-title">No Video Selected</h3>
              <p className="video-placeholder-subtitle">Choose a video file to start playing</p>
              <button
                className="video-select-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={24} />
                Select Video File
              </button>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleVideoFileSelect}
          style={{ display: 'none' }}
        />

        {videoFile && (
          <div className="video-overlay">
            <div className="video-controls">
              <button
                className="video-control-btn"
                onClick={togglePlayPause}
                title={`${isPlaying ? 'Pause' : 'Play'} (Space)`}
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <div className="video-progress">
                <div
                  className="progress-bar"
                  onClick={handleSeek}
                  onTouchStart={handleSeek}
                >
                  <div
                    className="progress-fill"
                    style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
              <div className="video-time">
                <span>{formatTime(currentTime)}</span>
                <span>/</span>
                <span>{formatTime(duration)}</span>
              </div>
              <div className="volume-controls">
                <button
                  className="video-control-btn"
                  onClick={toggleVideoMute}
                  title={`${isVideoMuted ? 'Unmute' : 'Mute'} (M)`}
                >
                  {isVideoMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isVideoMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="volume-slider"
                />
              </div>
              <button
                className="video-control-btn"
                onClick={toggleFullscreen}
                title="Fullscreen (F)"
              >
                <Maximize size={16} />
              </button>
              <button
                className="video-control-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Change Video"
              >
                <Upload size={16} />
              </button>
              {dataChannelReady && (
                <div className="sync-indicator" title="Video sync active">
                  <div className="sync-dot"></div>
                  <span>Sync</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoPlayer;
