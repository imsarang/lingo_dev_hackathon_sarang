import Image from "next/image";
import { getTranslations } from 'next-intl/server';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import { AuthComponent } from '../../components/AuthComponent';

export default async function Home() {
  const t = await getTranslations('common');

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <div className="absolute top-4 right-4 flex items-center gap-3">
          <LanguageSwitcher />
          <AuthComponent />
        </div>
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={100}
          height={20}
          priority
        />
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            AI Document Assistant
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Chat with our AI assistant to get answers from your documents. Powered by advanced RAG technology for accurate and contextual responses.
          </p>
        </div>
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <a
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-6 text-white transition-all hover:from-blue-700 hover:to-purple-700 shadow-md md:w-auto"
            href="/chat"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
          >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
            Start Chatting
          </a>
        </div>
      </main>
    </div>
  );
}
