import ChatInterface from '../../../components/ChatInterface';
import { getTranslations } from 'next-intl/server';

export default async function ChatPage() {
  const t = await getTranslations('common');

  return (
    <div className="h-screen w-full">
      <ChatInterface />
    </div>
  );
}
