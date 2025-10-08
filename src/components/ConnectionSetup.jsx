import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { copyToClipboard } from '../utils/videoUtils';

const ConnectionSetup = ({
  localOffer,
  localAnswer,
  remoteDescription,
  setRemoteDescription,
  createDataChannelOffer,
  handleRemoteDescription
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyToClipboard = (text) => {
    copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="connection-grid">
      <div className="webrtc-card">
        <h2 className="card-title">
          Step 1: Create Connection
        </h2>

        <button
          onClick={createDataChannelOffer}
          className="neumorphic-btn primary"
        >
          Create Offer
        </button>

        {localOffer && (
          <div style={{ marginBottom: '16px' }}>
            <div className="copy-section">
              <label className="webrtc-label">
                Your Offer:
              </label>
              <button
                onClick={() => handleCopyToClipboard(localOffer)}
                className="copy-btn"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <textarea
              value={localOffer}
              readOnly
              className="webrtc-textarea"
              onClick={(e) => e.target.select()}
            />
          </div>
        )}

        {localAnswer && (
          <div style={{ marginBottom: '16px' }}>
            <div className="copy-section">
              <label className="webrtc-label">
                Your Answer:
              </label>
              <button
                onClick={() => handleCopyToClipboard(localAnswer)}
                className="copy-btn"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <textarea
              value={localAnswer}
              readOnly
              className="webrtc-textarea"
              onClick={(e) => e.target.select()}
            />
          </div>
        )}
      </div>

      <div className="webrtc-card">
        <h2 className="card-title">
          Step 2: Exchange Descriptions
        </h2>

        <label className="webrtc-label">
          Paste Remote Description:
        </label>
        <textarea
          value={remoteDescription}
          onChange={(e) => setRemoteDescription(e.target.value)}
          placeholder="Paste the offer or answer from the other peer here..."
          className="webrtc-textarea"
        />

        <button
          onClick={handleRemoteDescription}
          className="neumorphic-btn success"
        >
          Process Remote Description
        </button>
      </div>
    </div>
  );
};

export default ConnectionSetup;
