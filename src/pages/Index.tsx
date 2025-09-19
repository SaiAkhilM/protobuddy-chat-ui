import ProtoBuddy from '@/components/ProtoBuddy';

const Index = () => {
  const handleSendMessage = (message: string) => {
    console.log('Message sent:', message);
    // Here you would typically send the message to your backend API
  };

  return (
    <div className="h-screen">
      <ProtoBuddy onSendMessage={handleSendMessage} />
    </div>
  );
};

export default Index;
