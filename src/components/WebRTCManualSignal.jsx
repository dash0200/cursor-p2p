import React, { useState, useRef, useEffect } from 'react';
import './WebRTCManualSignal.css';

// Import custom hooks
import { useWebRTC } from '../hooks/useWebRTC';
import { useVideoPlayer } from '../hooks/useVideoPlayer';
import { useChat } from '../hooks/useChat';

// Import components
import ConnectionSetup from './ConnectionSetup';
import VideoPlayer from './VideoPlayer';
import Sidebar from './Sidebar';

export default function WebRTCManualSignal() {
  const [activeTab, setActiveTab] = useState('voice');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const logContainerRef = useRef(null);

  // Initialize custom hooks
  const webrtc = useWebRTC();
  const videoPlayer = useVideoPlayer(webrtc.sendMessage, webrtc.addLog);
  const chat = useChat(webrtc.sendMessage);

  // Handle video and chat messages from WebRTC
  const handleVideoMessage = (message) => {
    if (message.type === 'video-play') {
      if (videoPlayer.videoRef.current) {
        videoPlayer.videoRef.current.play().then(() => {
          videoPlayer.setIsPlaying(true);
          const time = message.time !== undefined ? message.time : videoPlayer.videoRef.current.currentTime;
          webrtc.addLog(`Played by peer at ${videoPlayer.formatTime(time)}`);
        }).catch((error) => {
          console.log('Remote play failed:', error);
          webrtc.addLog('Remote play failed - may need user interaction');
        });
      }
    } else if (message.type === 'video-pause') {
      if (videoPlayer.videoRef.current) {
        videoPlayer.videoRef.current.pause();
        videoPlayer.setIsPlaying(false);
        const time = message.time !== undefined ? message.time : videoPlayer.videoRef.current.currentTime;
        webrtc.addLog(`Paused by peer at ${videoPlayer.formatTime(time)}`);
      }
    } else if (message.type === 'video-seek') {
      if (videoPlayer.videoRef.current && message.time !== undefined) {
        videoPlayer.videoRef.current.currentTime = message.time;
        videoPlayer.setCurrentTime(message.time);
        webrtc.addLog(`Seeked by peer to ${videoPlayer.formatTime(message.time)}`);
      }
    } else if (message.type === 'video-file') {
      if (message.fileName && message.fileSize) {
        webrtc.addLog(`Remote peer selected local video: ${message.fileName} (${Math.round(message.fileSize / 1024 / 1024 * 100) / 100} MB)`);
        webrtc.addLog('Note: You need to select the same local video file to sync playback');
      }
    } else if (message.type === 'youtube-video') {
      // Handle YouTube video from peer
      if (message.videoId) {
        webrtc.addLog(`Remote peer loaded YouTube video: ${message.videoId} (timestamp: ${message.timestamp || 'unknown'})`);
        webrtc.addLog(`Current peer video: ${videoPlayer.youtubeVideoId}, New video: ${message.videoId}`);
        
        // Always reload the video, even if it's the same video ID
        webrtc.addLog('Loading YouTube video for peer...');
        videoPlayer.loadYouTubeVideo(message.videoId, message.url, true, true).then(() => {
          webrtc.addLog('YouTube video loaded successfully for peer');
        }).catch((error) => {
          webrtc.addLog(`Error loading YouTube video for peer: ${error.message}`);
        });
      }
    } else if (message.type === 'youtube-play') {
      if (videoPlayer.youtubePlayerManagerRef?.current && videoPlayer.youtubePlayerManagerRef.current.isReady) {
        videoPlayer.youtubePlayerManagerRef.current.playVideo();
        videoPlayer.setIsPlaying(true);
        const time = message.time !== undefined ? message.time : 0;
        webrtc.addLog(`YouTube played by peer at ${videoPlayer.formatTime(time)}`);
      } else {
        // Queue the command if player isn't ready
        videoPlayer.addPendingCommand({ type: 'play', time: message.time });
        webrtc.addLog('YouTube player not ready, queuing play command');
      }
    } else if (message.type === 'youtube-pause') {
      if (videoPlayer.youtubePlayerManagerRef?.current && videoPlayer.youtubePlayerManagerRef.current.isReady) {
        videoPlayer.youtubePlayerManagerRef.current.pauseVideo();
        videoPlayer.setIsPlaying(false);
        const time = message.time !== undefined ? message.time : 0;
        webrtc.addLog(`YouTube paused by peer at ${videoPlayer.formatTime(time)}`);
      } else {
        // Queue the command if player isn't ready
        videoPlayer.addPendingCommand({ type: 'pause', time: message.time });
        webrtc.addLog('YouTube player not ready, queuing pause command');
      }
    } else if (message.type === 'youtube-seek') {
      if (videoPlayer.youtubePlayerManagerRef?.current && videoPlayer.youtubePlayerManagerRef.current.isReady && message.time !== undefined) {
        videoPlayer.youtubePlayerManagerRef.current.seekTo(message.time, true);
        videoPlayer.setCurrentTime(message.time);
        webrtc.addLog(`YouTube seeked by peer to ${videoPlayer.formatTime(message.time)}`);
      } else {
        // Queue the command if player isn't ready
        videoPlayer.addPendingCommand({ type: 'seek', time: message.time });
        webrtc.addLog('YouTube player not ready, queuing seek command');
      }
    } else if (message.type === 'direct-video') {
      if (message.url) {
        webrtc.addLog(`Loading direct video from peer: ${message.url}`);
        try {
          // Clear all video states for seamless switching
          videoPlayer.clearAllVideoStates();
          
          // Set the direct video URL
          videoPlayer.setDirectVideoUrl(message.url);
          
          // Load the direct video URL
          if (videoPlayer.videoRef.current) {
            videoPlayer.videoRef.current.src = message.url;
            videoPlayer.videoRef.current.onloadeddata = () => {
              videoPlayer.setDirectVideoLoaded(true);
              videoPlayer.setDuration(videoPlayer.videoRef.current.duration);
              webrtc.addLog('Direct video loaded from peer');
            };
            videoPlayer.videoRef.current.onerror = (error) => {
              webrtc.addLog(`Error loading direct video from peer: ${error.message || 'Unknown error'}`);
              videoPlayer.setDirectVideoLoaded(false);
            };
          }
        } catch (error) {
          webrtc.addLog(`Error handling direct video from peer: ${error.message}`);
        }
      }
    }
  };

  const handleChatMessage = (message) => {
    chat.addChatMessage(message);
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const handleFullReset = () => {
    // Only reset UI components, preserve WebRTC connection
    webrtc.resetLogs();
    chat.resetChat();
    videoPlayer.resetVideoPlayer();
    
    // Reset UI state
    setActiveTab('voice');
    setIsSidebarCollapsed(false);
    
    webrtc.addLog('UI reset completed - connection preserved');
  };

  // Auto-scroll logs container
  useEffect(() => {
    if (logContainerRef.current) {
      requestAnimationFrame(() => {
        logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      });
    }
  }, [webrtc.logs]);

  return (
    <div className={`webrtc-container ${webrtc.connectionState === 'connected' ? 'connected' : ''} ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Left Side (75% when sidebar visible, 100% when collapsed) */}
      <div className="webrtc-left">
        {webrtc.connectionState !== 'connected' && (
          <ConnectionSetup
            localOffer={webrtc.localOffer}
            localAnswer={webrtc.localAnswer}
            remoteDescription={webrtc.remoteDescription}
            setRemoteDescription={webrtc.setRemoteDescription}
            createDataChannelOffer={() => webrtc.createDataChannelOffer(handleVideoMessage, handleChatMessage)}
            handleRemoteDescription={() => webrtc.handleRemoteDescription(handleVideoMessage, handleChatMessage)}
            isGeneratingOffer={webrtc.isGeneratingOffer}
            resetConnection={webrtc.resetConnection}
          />
        )}

        {webrtc.connectionState === 'connected' && (
          <VideoPlayer
            videoRef={videoPlayer.videoRef}
            fileInputRef={videoPlayer.fileInputRef}
            youtubeIframeRef={videoPlayer.youtubeIframeRef}
            youtubePlayerManagerRef={videoPlayer.youtubePlayerManagerRef}
            videoFile={videoPlayer.videoFile}
            youtubeUrl={videoPlayer.youtubeUrl}
            youtubeVideoId={videoPlayer.youtubeVideoId}
            directVideoUrl={videoPlayer.directVideoUrl}
            directVideoLoaded={videoPlayer.directVideoLoaded}
            youtubeInputUrl={videoPlayer.youtubeInputUrl}
            directVideoInputUrl={videoPlayer.directVideoInputUrl}
            isPlaying={videoPlayer.isPlaying}
            currentTime={videoPlayer.currentTime}
            duration={videoPlayer.duration}
            volume={videoPlayer.volume}
            isVideoMuted={videoPlayer.isVideoMuted}
            dataChannelReady={webrtc.dataChannelRef.current?.readyState === 'open'}
            handleVideoFileSelect={videoPlayer.handleVideoFileSelect}
            handleYoutubeUrlChange={videoPlayer.handleYoutubeUrlChange}
            handleYoutubeSubmit={videoPlayer.handleYoutubeSubmit}
            handleDirectVideoUrlChange={videoPlayer.handleDirectVideoUrlChange}
            handleDirectVideoSubmit={videoPlayer.handleDirectVideoSubmit}
            togglePlayPause={videoPlayer.togglePlayPause}
            handleSeek={videoPlayer.handleSeek}
            handleVolumeChange={videoPlayer.handleVolumeChange}
            toggleVideoMute={videoPlayer.toggleVideoMute}
            toggleFullscreen={videoPlayer.toggleFullscreen}
            formatTime={videoPlayer.formatTime}
          />
        )}
      </div>

      {/* Sidebar Toggle Button - Only show when connected */}
      {webrtc.connectionState === 'connected' && (
        <button
          className={`sidebar-toggle ${isSidebarCollapsed ? 'collapsed' : ''}`}
          onClick={toggleSidebar}
          title={isSidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
        >
          {isSidebarCollapsed ? '◀' : '▶'}
        </button>
      )}

      {/* Neumorphic Gutter - Only show when connected and not collapsed */}
      {webrtc.connectionState === 'connected' && !isSidebarCollapsed && <div className="webrtc-gutter"></div>}

      {/* Right Side (25%) - Only show when connected and not collapsed */}
      {webrtc.connectionState === 'connected' && !isSidebarCollapsed && (
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          inVoiceChannel={webrtc.inVoiceChannel}
          remoteInVoiceChannel={webrtc.remoteInVoiceChannel}
          isMuted={webrtc.isMuted}
          localVoiceActivity={webrtc.localVoiceActivity}
          remoteVoiceActivity={webrtc.remoteVoiceActivity}
          joinVoiceChannel={webrtc.joinVoiceChannel}
          leaveVoiceChannel={webrtc.leaveVoiceChannel}
          toggleMute={webrtc.toggleMute}
          chatMessages={chat.chatMessages}
          chatMessage={chat.chatMessage}
          setChatMessage={chat.setChatMessage}
          chatContainerRef={chat.chatContainerRef}
          sendChatMessage={chat.sendChatMessage}
          handleChatKeyPress={chat.handleChatKeyPress}
          logs={webrtc.logs}
          logContainerRef={logContainerRef}
          onFullReset={handleFullReset}
        />
      )}

      {/* Hidden audio element for remote audio */}
      <audio ref={webrtc.remoteAudioRef} autoPlay className="webrtc-audio" />
    </div>
  );
}