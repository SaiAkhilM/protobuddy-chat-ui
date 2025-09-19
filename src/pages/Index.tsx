import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import ProtoBuddy from '@/components/ProtoBuddy';
import { apiClient, ChatMessage } from '@/lib/api';

const Index = () => {
  const [sessionId, setSessionId] = useState<string>(() => uuidv4());

  const handleSendMessage = async (message: string): Promise<ChatMessage | null> => {
    try {
      const response = await apiClient.sendChatMessage(message, sessionId);

      if (response.success && response.data) {
        // Update session ID if it changed
        if (response.data.sessionId !== sessionId) {
          setSessionId(response.data.sessionId);
        }

        return response.data.message;
      } else {
        console.error('Chat API error:', response.error || response.message);
        return null;
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      return null;
    }
  };

  return (
    <div className="h-screen">
      <ProtoBuddy onSendMessage={handleSendMessage} />
    </div>
  );
};

export default Index;
