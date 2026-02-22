import Image from "next/image";
import { getTranslations } from 'next-intl/server';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import { AuthComponent } from '../../components/AuthComponent';
import Link from 'next/link';

export default async function Home({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('common');

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <div className="absolute top-4 right-4 flex items-center gap-3">
        <LanguageSwitcher />
        <AuthComponent />
      </div>
      <main className="flex min-h-screen w-full max-w-5xl flex-col items-center justify-center py-32 px-16 bg-white dark:bg-black sm:items-start">
        <Image
          className="dark:invert mb-8"
          src="/next.svg"
          alt="Next.js logo"
          width={100}
          height={20}
          priority
        />
        <div className="flex flex-col items-center gap-8 text-center sm:items-start sm:text-left w-full">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            AI Document Assistant
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Choose how you want to interact with your documents. Chat with our AI assistant or analyze reports with advanced tools.
          </p>
        </div>
        <div className="flex flex-col gap-6 w-full mt-12 sm:flex-row">
          <Link
            href={`/${locale}/chat`}
            className="flex flex-col h-64 w-full items-center justify-center gap-4 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 px-8 text-white transition-all hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl transform hover:-translate-y-1 sm:w-1/2"
          >
            <svg
              className="w-16 h-16"
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
            <h2 className="text-2xl font-bold">Chat with Bot</h2>
            <p className="text-center text-blue-100">
              Ask questions and get answers from your documents using advanced RAG technology
            </p>
          </Link>
          <Link
            href={`/${locale}/analyzer`}
            className="flex flex-col h-64 w-full items-center justify-center gap-4 rounded-2xl bg-gradient-to-br from-green-600 to-teal-600 px-8 text-white transition-all hover:from-green-700 hover:to-teal-700 shadow-lg hover:shadow-xl transform hover:-translate-y-1 sm:w-1/2"
          >
            <svg
              className="w-16 h-16"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h2 className="text-2xl font-bold">Report Analyzer</h2>
            <p className="text-center text-green-100">
              Upload and analyze reports with AI-powered insights, keyword suggestions, and benchmarking
            </p>
          </Link>
        </div>
      </main>
    </div>
  );
}
