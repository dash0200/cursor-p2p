import React from 'react';
import VideoCall from './VideoCall';
import Chat from './Chat';
import Logs from './Logs';

const Sidebar = ({
  activeTab,
  setActiveTab,
  inVoiceChannel,
  remoteInVoiceChannel,
  isMuted,
  inVideoChannel,
  remoteInVideoChannel,
  isVideoMuted,
  localVideoStreamRef,
  remoteVideoRef,
  joinVoiceChannel,
  leaveVoiceChannel,
  toggleMute,
  toggleVideoMute,
  chatMessages,
  chatMessage,
  setChatMessage,
  chatContainerRef,
  sendChatMessage,
  handleChatKeyPress,
  logs,
  logContainerRef
}) => {
  return (
    <div className="webrtc-right">
      <div className="tabs-header">
        <button
          className={`tab-button ${activeTab === 'voice' ? 'active' : ''}`}
          onClick={() => setActiveTab('voice')}
        >
          Voice
        </button>
        <button
          className={`tab-button ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          Chat
        </button>
        <button
          className={`tab-button ${activeTab === 'log' ? 'active' : ''}`}
          onClick={() => setActiveTab('log')}
        >
          Logs
        </button>
      </div>

      {/* Voice Channel Tab */}
      <div className={`tab-panel ${activeTab !== 'voice' ? 'hidden' : ''}`}>
        <VideoCall
          inVoiceChannel={inVoiceChannel}
          remoteInVoiceChannel={remoteInVoiceChannel}
          isMuted={isMuted}
          inVideoChannel={inVideoChannel}
          remoteInVideoChannel={remoteInVideoChannel}
          isVideoMuted={isVideoMuted}
          localVideoStreamRef={localVideoStreamRef}
          remoteVideoRef={remoteVideoRef}
          joinVoiceChannel={joinVoiceChannel}
          leaveVoiceChannel={leaveVoiceChannel}
          toggleMute={toggleMute}
          toggleVideoMute={toggleVideoMute}
        />
      </div>

      {/* Chat Tab */}
      <div className={`tab-panel ${activeTab !== 'chat' ? 'hidden' : ''}`}>
        <Chat
          chatMessages={chatMessages}
          chatMessage={chatMessage}
          setChatMessage={setChatMessage}
          chatContainerRef={chatContainerRef}
          sendChatMessage={sendChatMessage}
          handleChatKeyPress={handleChatKeyPress}
        />
      </div>

      {/* Log Tab */}
      <div className={`tab-panel ${activeTab !== 'log' ? 'hidden' : ''}`}>
        <Logs
          logs={logs}
          logContainerRef={logContainerRef}
        />
      </div>
    </div>
  );
};

export default Sidebar;
