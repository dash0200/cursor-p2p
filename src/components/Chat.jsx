import React from 'react';

const Chat = ({
  chatMessages,
  chatMessage,
  setChatMessage,
  chatContainerRef,
  sendChatMessage,
  handleChatKeyPress
}) => {
  return (
    <div className="log-card">
      <div className="chat-container" ref={chatContainerRef}>
        {chatMessages.length === 0 ? (
          <div className="log-empty">No messages yet</div>
        ) : (
          chatMessages.map((msg, index) => (
            <div key={index} className={`chat-message ${msg.sender === 'You' ? 'sent' : 'received'}`}>
              <div className="message-content">
                <div className="message-bubble">
                  <div className="message-text">{msg.text}</div>
                </div>
                <div className="message-time">{msg.timestamp}</div>
              </div>
            </div>
          ))
        )}
      </div>
      <div className='input-container'>
        <input
          type="text"
          value={chatMessage}
          onChange={(e) => setChatMessage(e.target.value)}
          onKeyPress={handleChatKeyPress}
          placeholder="Type a message..."
          className="chat-input"
        />
        <button
          onClick={sendChatMessage}
          className="chat-send-btn"
          disabled={!chatMessage.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default Chat;
