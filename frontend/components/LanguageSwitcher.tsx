'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { locales, type Locale } from '../i18n';

const localeNames: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  hi: 'हिन्दी',
  de: 'Deutsch'
};

export default function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const [isTranslating, setIsTranslating] = useState(false);

  // Check if translation is in progress
  useEffect(() => {
    const checkTranslation = () => {
      const status = localStorage.getItem('isTranslating');
      setIsTranslating(status === 'true');
    };

    // Check immediately
    checkTranslation();

    // Check every 200ms for updates
    const interval = setInterval(checkTranslation, 200);

    return () => clearInterval(interval);
  }, []);

  const switchLocale = (locale: Locale) => {
    // Don't switch if translation is in progress
    if (isTranslating) return;

    // Remove current locale from pathname and add new one
    const segments = pathname.split('/').filter(Boolean);
    const currentLocale = segments[0];
    
    if (locales.includes(currentLocale as Locale)) {
      segments[0] = locale;
    } else {
      segments.unshift(locale);
    }
    
    router.push('/' + segments.join('/'));
  };

  const currentLocale = pathname.split('/')[1] as Locale || 'en';

  return (
    <div className="flex gap-2">
      {locales.map((locale) => (
        <button
          key={locale}
          onClick={() => switchLocale(locale)}
          disabled={isTranslating}
          className={`px-3 py-1 rounded text-sm transition-colors ${
            isTranslating
              ? 'opacity-50 cursor-not-allowed'
              : currentLocale === locale
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          {localeNames[locale]}
        </button>
      ))}
    </div>
  );
}
