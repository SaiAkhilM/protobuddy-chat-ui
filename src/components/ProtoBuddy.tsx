import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Bot, 
  User, 
  Cpu, 
  Zap, 
  Settings,
  Microchip,
  Activity,
  Layers,
  Wifi,
  Battery,
  Signal,
  Code
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  type?: 'text' | 'component' | 'diagram';
}

interface ProtoBuddyProps {
  onSendMessage?: (message: string) => void;
}

const ProtoBuddy: React.FC<ProtoBuddyProps> = ({ onSendMessage }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: "👋 Hi! I'm ProtoBuddy. I help engineers find compatible components and solve hardware challenges. What are you building today?",
      sender: 'bot',
      timestamp: new Date(),
      type: 'text'
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
      type: 'text'
    };

    setMessages(prev => [...prev, newMessage]);
    setInputValue('');
    
    if (onSendMessage) {
      onSendMessage(inputValue);
    }

    // Enhanced bot responses
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      let botResponse: Message;
      
      if (inputValue.toLowerCase().includes('arduino') || inputValue.toLowerCase().includes('compatibility')) {
        botResponse = {
          id: (Date.now() + 1).toString(),
          content: "Great choice! For Arduino projects, I recommend checking component voltage levels (3.3V vs 5V), current requirements, and pin compatibility. Would you like me to show you a compatibility matrix for common sensors?",
          sender: 'bot',
          timestamp: new Date(),
          type: 'component'
        };
      } else {
        botResponse = {
          id: (Date.now() + 1).toString(),
          content: "I'd be happy to help you with that! Could you tell me more about your specific requirements or the type of project you're working on? I can assist with component selection, wiring diagrams, and compatibility checks.",
          sender: 'bot',
          timestamp: new Date(),
          type: 'text'
        };
      }
      
      setMessages(prev => [...prev, botResponse]);
    }, 2500);
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
    { name: 'Arduino Uno R3', specs: '5V, 32KB Flash', icon: Microchip, status: 'online' },
    { name: 'Raspberry Pi 4', specs: '3.3V GPIO, 8GB RAM', icon: Cpu, status: 'online' },
    { name: 'DHT22 Sensor', specs: 'Temp/Humidity, 3-5V', icon: Activity, status: 'compatible' },
    { name: 'HC-SR04 Ultrasonic', specs: '5V, 2-400cm range', icon: Signal, status: 'online' },
    { name: 'ESP32 DevKit', specs: 'WiFi/BT, 3.3V Logic', icon: Wifi, status: 'online' },
    { name: 'NeoPixel Strip', specs: 'WS2812B, 5V/3.3V', icon: Zap, status: 'compatible' },
  ];

  const quickActions = [
    { name: 'Arduino', icon: Microchip, color: 'circuit-green' },
    { name: 'Raspberry Pi', icon: Cpu, color: 'electric-orange' },
    { name: 'ESP32', icon: Wifi, color: 'cyan' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'circuit-green';
      case 'compatible': return 'cyan';
      case 'warning': return 'electric-orange';
      default: return 'muted';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-main circuit-pattern relative overflow-hidden">
      {/* Floating geometric shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-2 h-2 bg-circuit-green rounded-full opacity-60 animate-pulse"></div>
        <div className="absolute top-40 right-20 w-1 h-1 bg-cyan rounded-full opacity-40 animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute bottom-40 left-1/4 w-1.5 h-1.5 bg-electric-orange rounded-full opacity-50 animate-pulse" style={{animationDelay: '2s'}}></div>
      </div>

      <div className="flex min-h-screen relative z-10">
        {/* Enhanced Sidebar */}
        <div className="w-80 p-6 glass border-r border-glass-border hidden lg:block">
          <div className="space-y-6">
            {/* Quick Actions */}
            <div>
              <h3 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                Quick Access
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {quickActions.map((action) => (
                  <Button
                    key={action.name}
                    variant="outline"
                    size="sm"
                    className={`glass hover-lift border-glass-border bg-${action.color}/10 hover:bg-${action.color}/20 smooth-transition h-16 flex-col gap-1`}
                  >
                    <action.icon className={`w-5 h-5 text-${action.color}`} />
                    <span className="text-xs font-medium">{action.name}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Recent Components */}
            <div>
              <h3 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-primary" />
                Recent Components
              </h3>
              <div className="space-y-3">
                {recentComponents.map((component, index) => (
                  <Card key={index} className="glass border-glass-border hover-lift smooth-transition p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`p-2 rounded-lg bg-${getStatusColor(component.status)}/20`}>
                          <component.icon className={`w-4 h-4 text-${getStatusColor(component.status)}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">{component.name}</h4>
                          <p className="text-xs text-muted-foreground font-mono">{component.specs}</p>
                        </div>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={`text-xs border-${getStatusColor(component.status)} text-${getStatusColor(component.status)} bg-${getStatusColor(component.status)}/10`}
                      >
                        {component.status}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Settings */}
            <Card className="glass border-glass-border p-4 mt-auto">
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">Settings</p>
                  <p className="text-xs text-muted-foreground">Preferences & API</p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Main Chat Interface */}
        <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
          {/* Hero Header */}
          <div className="text-center py-12 px-6">
            <div className="mb-6">
              <h1 className="font-display font-black text-7xl md:text-8xl lg:text-9xl text-gradient glow-pulse mb-4">
                ProtoBuddy
              </h1>
              <p className="text-xl md:text-2xl font-display font-medium text-muted-foreground">
                AI Hardware Engineering Assistant
              </p>
              <div className="flex justify-center gap-2 mt-4">
                <Badge className="bg-primary/20 text-primary border-primary/30">
                  <Activity className="w-3 h-3 mr-1" />
                  Online
                </Badge>
                <Badge className="bg-circuit-green/20 text-circuit-green border-circuit-green/30">
                  <Code className="w-3 h-3 mr-1" />
                  AI Powered
                </Badge>
              </div>
            </div>
          </div>

          {/* Chat Container */}
          <div className="flex-1 px-6">
            <Card className="glass-strong border-glass-border h-[500px] flex flex-col glow-pulse">
              {/* Messages Area */}
              <ScrollArea className="flex-1 p-6">
                <div className="space-y-6">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-md lg:max-w-lg px-6 py-4 rounded-2xl smooth-transition ${
                          message.sender === 'user'
                            ? 'bg-gradient-to-r from-chat-user to-chat-user-glow text-chat-user-foreground shadow-lg shadow-primary/20'
                            : 'glass border-chat-bot-border text-chat-bot-foreground'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {message.sender === 'bot' && (
                            <div className="p-1.5 rounded-lg bg-primary/20 flex-shrink-0">
                              <Bot className="w-4 h-4 text-primary" />
                            </div>
                          )}
                          {message.sender === 'user' && (
                            <div className="p-1.5 rounded-lg bg-white/20 flex-shrink-0">
                              <User className="w-4 h-4" />
                            </div>
                          )}
                          <div className="flex-1">
                            <p className="text-sm leading-relaxed">{message.content}</p>
                            {message.type === 'component' && (
                              <div className="mt-3 p-3 rounded-lg bg-black/20 border border-white/10">
                                <div className="flex items-center gap-2 mb-2">
                                  <Microchip className="w-4 h-4 text-circuit-green" />
                                  <span className="text-xs font-medium text-circuit-green">Component Matrix</span>
                                </div>
                                <div className="text-xs font-mono text-muted-foreground">
                                  Arduino Uno → DHT22: ✓ Compatible<br/>
                                  Voltage: 5V ✓ | Pins: Digital ✓<br/>
                                  Current: &lt;2mA ✓
                                </div>
                              </div>
                            )}
                            <p className="text-xs opacity-70 mt-2 font-mono">
                              {formatTime(message.timestamp)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Enhanced Typing Indicator */}
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="max-w-md glass border-chat-bot-border px-6 py-4 rounded-2xl">
                        <div className="flex items-center gap-3">
                          <div className="p-1.5 rounded-lg bg-primary/20">
                            <Bot className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex gap-1.5">
                            <div className="w-2 h-2 bg-primary rounded-full typing-dot"></div>
                            <div className="w-2 h-2 bg-primary rounded-full typing-dot"></div>
                            <div className="w-2 h-2 bg-primary rounded-full typing-dot"></div>
                          </div>
                          <span className="text-xs text-muted-foreground ml-2">ProtoBuddy is thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Enhanced Input Area */}
              <div className="p-6 border-t border-glass-border">
                <div className="flex gap-3">
                  <Input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask about components, compatibility, wiring diagrams..."
                    className="flex-1 h-12 glass border-glass-border focus:border-primary focus:ring-2 focus:ring-primary/20 smooth-transition font-medium"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim()}
                    className="h-12 px-6 bg-gradient-to-r from-primary to-primary-glow hover:from-primary-dark hover:to-primary shadow-lg shadow-primary/20 hover-lift spring-transition disabled:opacity-50"
                  >
                    <Send className="w-5 h-5" />
                  </Button>
                </div>
                <div className="flex gap-2 mt-3">
                  <Badge variant="outline" className="text-xs cursor-pointer hover:bg-accent smooth-transition">
                    Arduino compatibility
                  </Badge>
                  <Badge variant="outline" className="text-xs cursor-pointer hover:bg-accent smooth-transition">
                    Wiring diagram
                  </Badge>
                  <Badge variant="outline" className="text-xs cursor-pointer hover:bg-accent smooth-transition">
                    Component specs
                  </Badge>
                </div>
              </div>
            </Card>
          </div>

          {/* Bottom Spacing */}
          <div className="h-8"></div>
        </div>
      </div>
    </div>
  );
};

export default ProtoBuddy;