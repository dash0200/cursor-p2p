import React, { useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Upload, Link } from 'lucide-react';
import { getYouTubeEmbedUrl } from '../utils/videoUtils';

const VideoPlayer = ({
  videoRef,
  fileInputRef,
  youtubeIframeRef,
  youtubePlayerManagerRef,
  videoFile,
  youtubeUrl,
  youtubeVideoId,
  directVideoUrl,
  directVideoLoaded,
  youtubeInputUrl,
  directVideoInputUrl,
  isPlaying,
  currentTime,
  duration,
  volume,
  isVideoMuted,
  dataChannelReady,
  handleVideoFileSelect,
  handleYoutubeUrlChange,
  handleYoutubeSubmit,
  handleDirectVideoUrlChange,
  handleDirectVideoSubmit,
  togglePlayPause,
  handleSeek,
  handleVolumeChange,
  toggleVideoMute,
  toggleFullscreen,
  formatTime
}) => {
  const [showYoutubeInput, setShowYoutubeInput] = useState(false);
  const [showDirectVideoInput, setShowDirectVideoInput] = useState(false);
  return (
    <div className="video-player-container">
      <div className="video-player-wrapper">
        {youtubeUrl ? (
          <div className="video-player youtube-player-container" onClick={togglePlayPause}>
            <iframe
              key={youtubeVideoId} // Force recreation when video changes
              ref={youtubeIframeRef}
              className="video-player youtube-player"
              src={getYouTubeEmbedUrl(youtubeVideoId)}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            ></iframe>
          </div>
        ) : (
          <video
            ref={videoRef}
            className="video-player"
            poster=""
            onClick={togglePlayPause}
            src={videoFile ? videoRef.current?.src || null : directVideoUrl || null}
          >
            Your browser does not support the video tag.
          </video>
        )}

        {!videoFile && !youtubeUrl && !directVideoUrl && (
          <div className="video-placeholder">
            <div className="video-placeholder-content">
              <h3 className="video-placeholder-title">No Video Selected</h3>
              <p className="video-placeholder-subtitle">Choose a video file, YouTube link, or direct video URL to start playing</p>
              <div className="video-select-buttons">
                <button
                  className="video-select-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={24} />
                  Select Video File
                </button>
                <button
                  className="video-select-btn youtube-btn"
                  onClick={() => setShowYoutubeInput(!showYoutubeInput)}
                >
                  <Link size={24} />
                  Add YouTube Link
                </button>
                <button
                  className="video-select-btn direct-video-btn"
                  onClick={() => setShowDirectVideoInput(!showDirectVideoInput)}
                >
                  <Link size={24} />
                  Add Direct Video Link
                </button>
              </div>
              {showYoutubeInput && (
                <div className="youtube-input-container">
                  <input
                    type="url"
                    placeholder="Paste YouTube URL here..."
                    value={youtubeInputUrl || ''}
                    onChange={handleYoutubeUrlChange}
                    className="youtube-url-input"
                    onKeyPress={(e) => e.key === 'Enter' && handleYoutubeSubmit(() => setShowYoutubeInput(false))}
                  />
                  <button
                    className="youtube-submit-btn"
                    onClick={() => handleYoutubeSubmit(() => setShowYoutubeInput(false))}
                    disabled={!youtubeInputUrl}
                  >
                    Load Video
                  </button>
                </div>
              )}
              {showDirectVideoInput && (
                <div className="direct-video-input-container">
                  <input
                    type="url"
                    placeholder="Paste direct video URL here (e.g., .mp4, .webm, .mov)..."
                    value={directVideoInputUrl || ''}
                    onChange={handleDirectVideoUrlChange}
                    className="direct-video-url-input"
                    onKeyPress={(e) => e.key === 'Enter' && handleDirectVideoSubmit(() => setShowDirectVideoInput(false))}
                  />
                  <button
                    className="direct-video-submit-btn"
                    onClick={() => handleDirectVideoSubmit(() => setShowDirectVideoInput(false))}
                    disabled={!directVideoInputUrl}
                  >
                    Load Video
                  </button>
                </div>
              )}
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

        {(videoFile || youtubeUrl || directVideoUrl) && (
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
                className={`video-control-btn ${videoFile ? 'active' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                title={videoFile ? "Local Video Active - Click to Change" : "Select Local Video File"}
              >
                <Upload size={16} />
              </button>
              <button
                className={`video-control-btn youtube-btn ${youtubeUrl ? 'active' : ''}`}
                onClick={() => setShowYoutubeInput(!showYoutubeInput)}
                title={youtubeUrl ? "YouTube Video Active - Click to Change" : "Add YouTube Video"}
              >
                <Link size={16} />
              </button>
              <button
                className={`video-control-btn direct-video-btn ${directVideoUrl ? 'active' : ''}`}
                onClick={() => setShowDirectVideoInput(!showDirectVideoInput)}
                title={directVideoUrl ? "Direct Video Active - Click to Change" : "Add Direct Video Link"}
              >
                <Link size={16} />
              </button>
              {dataChannelReady && (
                <div className="sync-indicator" title="Video sync active">
                  <div className="sync-dot"></div>
                  <span>Sync</span>
                </div>
              )}
              {youtubeUrl && youtubePlayerManagerRef?.current?.isReady && (
                <div className="youtube-ready-indicator" title="YouTube player ready">
                  <div className="ready-dot"></div>
                  <span>Ready</span>
                </div>
              )}
              {youtubeUrl && (
                <div className="video-type-indicator youtube-video" title="YouTube video">
                  <div className="type-dot"></div>
                  <span>YouTube</span>
                </div>
              )}
              {videoFile && (
                <div className="video-type-indicator local-video" title="Local video file">
                  <div className="type-dot"></div>
                  <span>Local</span>
                </div>
              )}
              {directVideoUrl && (
                <div className="video-type-indicator direct-video" title="Direct video URL">
                  <div className="type-dot"></div>
                  <span>Direct</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* YouTube URL Input - Show when video is loaded and input is toggled */}
        {(videoFile || youtubeUrl) && showYoutubeInput && (
          <div className="youtube-input-overlay">
            <div className="youtube-input-container">
              <input
                type="url"
                placeholder="Paste YouTube URL here..."
                value={youtubeInputUrl || ''}
                onChange={handleYoutubeUrlChange}
                className="youtube-url-input"
                onKeyPress={(e) => e.key === 'Enter' && handleYoutubeSubmit(() => setShowYoutubeInput(false))}
              />
              <button
                className="youtube-submit-btn"
                onClick={() => handleYoutubeSubmit(() => setShowYoutubeInput(false))}
                disabled={!youtubeInputUrl}
              >
                Load Video
              </button>
              <button
                className="youtube-close-btn"
                onClick={() => setShowYoutubeInput(false)}
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Direct Video URL Input - Show when video is loaded and input is toggled */}
        {(videoFile || youtubeUrl || directVideoUrl) && showDirectVideoInput && (
          <div className="direct-video-input-overlay">
            <div className="direct-video-input-container">
              <input
                type="url"
                placeholder="Paste direct video URL here (e.g., .mp4, .webm, .mov)..."
                value={directVideoInputUrl || ''}
                onChange={handleDirectVideoUrlChange}
                className="direct-video-url-input"
                onKeyPress={(e) => e.key === 'Enter' && handleDirectVideoSubmit(() => setShowDirectVideoInput(false))}
              />
              <button
                className="direct-video-submit-btn"
                onClick={() => handleDirectVideoSubmit(() => setShowDirectVideoInput(false))}
                disabled={!directVideoInputUrl}
              >
                Load Video
              </button>
              <button
                className="direct-video-close-btn"
                onClick={() => setShowDirectVideoInput(false)}
              >
                ×
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoPlayer;
