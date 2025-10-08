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
        webrtc.addLog(`Remote peer selected video: ${message.fileName} (${Math.round(message.fileSize / 1024 / 1024 * 100) / 100} MB)`);
      }
    }
  };

  const handleChatMessage = (message) => {
    chat.addChatMessage(message);
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
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
          />
        )}

        {webrtc.connectionState === 'connected' && (
          <VideoPlayer
            videoRef={videoPlayer.videoRef}
            fileInputRef={videoPlayer.fileInputRef}
            videoFile={videoPlayer.videoFile}
            isPlaying={videoPlayer.isPlaying}
            currentTime={videoPlayer.currentTime}
            duration={videoPlayer.duration}
            volume={videoPlayer.volume}
            isVideoMuted={videoPlayer.isVideoMuted}
            dataChannelReady={webrtc.dataChannelRef.current?.readyState === 'open'}
            handleVideoFileSelect={videoPlayer.handleVideoFileSelect}
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
        />
      )}

      {/* Hidden audio element for remote audio */}
      <audio ref={webrtc.remoteAudioRef} autoPlay className="webrtc-audio" />
    </div>
  );
}