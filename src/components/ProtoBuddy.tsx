import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Cpu, Zap, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';

export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

interface ProtoBuddyProps {
  onSendMessage?: (message: string) => void;
}

const ProtoBuddy: React.FC<ProtoBuddyProps> = ({ onSendMessage }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: "Hi! I'm ProtoBuddy. I can help you find compatible components for your hardware projects. Tell me what you're building!",
      sender: 'bot',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, newMessage]);
    setInputValue('');
    
    // Trigger callback if provided
    if (onSendMessage) {
      onSendMessage(inputValue);
    }

    // Simulate bot typing
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: "I'd be happy to help you with that! Could you tell me more about your specific requirements or the type of project you're working on?",
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botResponse]);
    }, 2000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const recentComponents = [
    'Arduino Uno R3',
    'Raspberry Pi 4',
    'DHT22 Sensor',
    'HC-SR04 Ultrasonic',
    'ESP32 DevKit',
    'NeoPixel Strip',
  ];

  return (
    <div className="flex h-screen bg-gradient-chat">
      {/* Sidebar */}
      <div className="w-64 bg-secondary border-r border-border p-4 hidden md:block">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Cpu className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Recent Components</h3>
          </div>
          <div className="space-y-2">
            {recentComponents.map((component, index) => (
              <Card key={index} className="p-3 hover:bg-accent cursor-pointer chat-transition">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  <span className="text-sm">{component}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
        
        <div className="mt-auto">
          <Card className="p-3 bg-accent">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Settings</span>
            </div>
          </Card>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-secondary border-b border-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
              <Bot className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">ProtoBuddy - Hardware Component Assistant</h1>
              <p className="text-muted-foreground text-sm">
                Ask me about Arduino, Raspberry Pi, sensors, and component compatibility
              </p>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4 max-w-4xl mx-auto">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl chat-transition ${
                    message.sender === 'user'
                      ? 'bg-chat-user text-chat-user-foreground'
                      : 'bg-chat-bot text-chat-bot-foreground'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {message.sender === 'bot' && (
                      <Bot className="w-4 h-4 mt-1 text-primary flex-shrink-0" />
                    )}
                    {message.sender === 'user' && (
                      <User className="w-4 h-4 mt-1 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm">{message.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {formatTime(message.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-2xl bg-chat-bot">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-primary flex-shrink-0" />
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-muted-foreground rounded-full typing-dot"></div>
                      <div className="w-2 h-2 bg-muted-foreground rounded-full typing-dot"></div>
                      <div className="w-2 h-2 bg-muted-foreground rounded-full typing-dot"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="bg-secondary border-t border-border p-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about components, compatibility, or project ideas..."
                className="flex-1 bg-input border-border chat-transition focus:ring-2 focus:ring-primary"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputValue.trim()}
                className="px-4 bg-primary hover:bg-primary/90 chat-transition"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProtoBuddy;