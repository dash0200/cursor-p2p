import React from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2 } from 'lucide-react';

const VoiceControls = ({
  inVoiceChannel,
  remoteInVoiceChannel,
  isMuted,
  joinVoiceChannel,
  leaveVoiceChannel,
  toggleMute
}) => {
  return (
    <div className="voice-channel-card">
      <div className="voice-channel-visual">
        <div className="voice-avatar">
          <div className={`voice-avatar-circle ${inVoiceChannel ? 'active' : ''}`}>
            <Volume2 style={{ color: 'white' }} size={24} />
          </div>
          <p className="voice-avatar-name">You</p>
          <p className="voice-avatar-status">{inVoiceChannel ? 'Connected' : 'Not in channel'}</p>
        </div>

        <div className="audio-visualization">
          <div className="audio-bars">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={`audio-bar ${inVoiceChannel && remoteInVoiceChannel ? 'active' : ''}`}
                style={{ animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </div>
        </div>

        <div className="voice-avatar">
          <div className={`voice-avatar-circle ${remoteInVoiceChannel ? 'active' : ''}`}>
            <Volume2 style={{ color: 'white' }} size={24} />
          </div>
          <p className="voice-avatar-name">Remote</p>
          <p className="voice-avatar-status">{remoteInVoiceChannel ? 'Connected' : 'Not in channel'}</p>
        </div>
      </div>

      {!inVoiceChannel ? (
        <button
          onClick={joinVoiceChannel}
          className="voice-control-btn join"
        >
          <Phone size={16} />
          Join Voice
        </button>
      ) : (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={toggleMute}
            className={`voice-control-btn mute ${isMuted ? 'active' : ''}`}
          >
            {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
            {isMuted ? 'Unmute' : 'Mute'}
          </button>
          <button
            onClick={leaveVoiceChannel}
            className="voice-control-btn leave"
          >
            <PhoneOff size={16} />
            Leave
          </button>
        </div>
      )}
    </div>
  );
};

export default VoiceControls;
