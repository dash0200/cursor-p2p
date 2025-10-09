import React, { useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, Video, VideoOff } from 'lucide-react';

const VideoCall = ({
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
  toggleVideoMute
}) => {
  const localVideoElementRef = useRef(null);

  // Connect local video stream to video element
  useEffect(() => {
    if (localVideoStreamRef?.current && localVideoElementRef.current) {
      console.log('Setting local video stream to element:', localVideoStreamRef.current);
      localVideoElementRef.current.srcObject = localVideoStreamRef.current;
      localVideoElementRef.current.play().catch(err => {
        console.log('Local video play failed:', err);
      });
    }
  }, [localVideoStreamRef?.current, inVideoChannel]);

  // Connect remote video stream to video element
  useEffect(() => {
    if (remoteVideoRef?.current) {
      console.log('Remote video element available:', remoteVideoRef.current);
      console.log('Remote video stream:', remoteVideoRef.current.srcObject);
      
      // Test if video element is working by checking its properties
      console.log('Remote video element properties:', {
        videoWidth: remoteVideoRef.current.videoWidth,
        videoHeight: remoteVideoRef.current.videoHeight,
        readyState: remoteVideoRef.current.readyState,
        paused: remoteVideoRef.current.paused,
        muted: remoteVideoRef.current.muted,
        autoplay: remoteVideoRef.current.autoplay
      });
    }
  }, [remoteVideoRef?.current, remoteInVideoChannel]);

  // Debug logging
  useEffect(() => {
    console.log('VideoCall props:', {
      inVoiceChannel,
      inVideoChannel,
      remoteInVideoChannel,
      localVideoStreamRef: localVideoStreamRef?.current,
      remoteVideoRef: remoteVideoRef?.current,
      localVideoElementRef: localVideoElementRef?.current
    });
  }, [inVoiceChannel, inVideoChannel, remoteInVideoChannel, localVideoStreamRef, remoteVideoRef]);

  // Test function to verify remote video element works
  const testRemoteVideo = () => {
    if (remoteVideoRef?.current && localVideoStreamRef?.current) {
      console.log('Testing remote video with local stream...');
      remoteVideoRef.current.srcObject = localVideoStreamRef.current;
      remoteVideoRef.current.play().catch(err => {
        console.log('Test remote video play failed:', err);
      });
    }
  };

  return (
    <div className="video-call-container">
      {/* Video Section - Top Half */}
      <div className="video-section">
        {!inVoiceChannel ? (
          <div className="video-join-container">
            <div className="video-join-content">
              <div className="video-join-icon">
                <Phone size={48} />
              </div>
              <h3 className="video-join-title">Join Voice & Video Call</h3>
              <p className="video-join-subtitle">Start a video call with your peer</p>
              <button
                onClick={joinVoiceChannel}
                className="video-join-btn"
              >
                <Phone size={20} />
                Join Voice & Video
              </button>
            </div>
          </div>
        ) : (
          <div className="video-call-grid">
            {/* Local Video */}
            <div className="video-container local-video">
            <video
              ref={localVideoElementRef}
              autoPlay
              muted
              playsInline
              className="video-stream"
            />
              <div className="video-label">You</div>
              {!inVideoChannel && (
                <div className="video-placeholder">
                  <VideoOff size={32} />
                  <span>Camera Off</span>
                </div>
              )}
            </div>

            {/* Remote Video */}
            <div className="video-container remote-video">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="video-stream"
              style={{ display: remoteInVideoChannel ? 'block' : 'none' }}
            />
              <div className="video-label">Remote</div>
              {!remoteInVideoChannel && (
                <div className="video-placeholder">
                  <VideoOff size={32} />
                  <span>No Video</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Control Buttons Section - Middle */}
      {inVoiceChannel && (
        <div className="control-buttons-section">
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={toggleMute}
              className={`voice-control-btn mute ${isMuted ? 'active' : ''}`}
            >
              {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
              {isMuted ? 'Unmute' : 'Mute'}
            </button>
            <button
              onClick={toggleVideoMute}
              className={`voice-control-btn mute ${isVideoMuted ? 'active' : ''}`}
            >
              {isVideoMuted ? <VideoOff size={16} /> : <Video size={16} />}
              {isVideoMuted ? 'Show Video' : 'Hide Video'}
            </button>
            <button
              onClick={leaveVoiceChannel}
              className="voice-control-btn leave"
            >
              <PhoneOff size={16} />
              Leave
            </button>
            <button
              onClick={testRemoteVideo}
              className="voice-control-btn mute"
              style={{ fontSize: '10px', padding: '4px 8px' }}
            >
              Test Video
            </button>
          </div>
        </div>
      )}

      {/* Voice Controls Section - Bottom Half */}
      <div className="voice-section">
        <div className="voice-channel-card">
          <div className="voice-channel-visual">
            <div className="voice-avatar">
              <div className={`voice-avatar-circle ${inVoiceChannel ? 'active' : ''}`}>
                <Volume2 style={{ color: 'white' }} size={20} />
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
                <Volume2 style={{ color: 'white' }} size={20} />
              </div>
              <p className="voice-avatar-name">Remote</p>
              <p className="voice-avatar-status">{remoteInVoiceChannel ? 'Connected' : 'Not in channel'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoCall;
