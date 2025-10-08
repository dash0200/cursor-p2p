import { useState, useRef, useEffect } from 'react';

export const useChat = (sendMessage) => {
  const [chatMessage, setChatMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const chatContainerRef = useRef(null);

  const sendChatMessage = () => {
    if (chatMessage.trim() && sendMessage) {
      const message = {
        type: 'chat',
        text: chatMessage.trim(),
        timestamp: new Date().toLocaleTimeString(),
        sender: 'You'
      };

      setChatMessages(prev => [...prev, message]);
      sendMessage({ type: 'chat', text: chatMessage.trim(), timestamp: message.timestamp });
      setChatMessage('');
    }
  };

  const handleChatKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  };

  const addChatMessage = (message) => {
    setChatMessages(prev => [...prev, {
      type: 'chat',
      text: message.text,
      timestamp: message.timestamp,
      sender: 'Remote'
    }]);
  };

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (chatContainerRef.current) {
      requestAnimationFrame(() => {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      });
    }
  }, [chatMessages]);

  return {
    chatMessage,
    setChatMessage,
    chatMessages,
    chatContainerRef,
    sendChatMessage,
    handleChatKeyPress,
    addChatMessage
  };
};
