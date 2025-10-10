import React from 'react';
import VoiceControls from './VoiceControls';
import Chat from './Chat';
import Logs from './Logs';

const Sidebar = ({
  activeTab,
  setActiveTab,
  inVoiceChannel,
  remoteInVoiceChannel,
  isMuted,
  localVoiceActivity,
  remoteVoiceActivity,
  joinVoiceChannel,
  leaveVoiceChannel,
  toggleMute,
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
        <VoiceControls
          inVoiceChannel={inVoiceChannel}
          remoteInVoiceChannel={remoteInVoiceChannel}
          isMuted={isMuted}
          localVoiceActivity={localVoiceActivity}
          remoteVoiceActivity={remoteVoiceActivity}
          joinVoiceChannel={joinVoiceChannel}
          leaveVoiceChannel={leaveVoiceChannel}
          toggleMute={toggleMute}
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
