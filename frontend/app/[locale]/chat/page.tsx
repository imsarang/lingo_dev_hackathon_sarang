import ChatInterface from '../../../components/ChatInterface';
import { getTranslations } from 'next-intl/server';
import LanguageSwitcher from '../../../components/LanguageSwitcher';

export default async function ChatPage() {
  const t = await getTranslations('common');

  return (
    <div className="relative h-screen">
      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>
      <ChatInterface />
    </div>
  );
}
