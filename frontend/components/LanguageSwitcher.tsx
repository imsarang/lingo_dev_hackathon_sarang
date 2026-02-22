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

interface LanguageSwitcherProps {
  disabled?: boolean;
}

export default function LanguageSwitcher({ disabled = false }: LanguageSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isTranslating, setIsTranslating] = useState(false);

  // Check if translation is in progress
  useEffect(() => {
    const checkTranslationStatus = () => {
      const status = localStorage.getItem('isTranslating');
      setIsTranslating(status === 'true');
    };

    // Check immediately
    checkTranslationStatus();

    // Check every 200ms for updates
    const interval = setInterval(checkTranslationStatus, 200);

    return () => clearInterval(interval);
  }, []);

  const switchLocale = (locale: Locale) => {
    // Don't switch if translation is in progress or disabled
    if (isTranslating || disabled) return;

    // Remove current locale from pathname and add new one
    const segments = pathname.split('/').filter(Boolean);
    const currentLocale = segments[0];
    
    if (locales.includes(currentLocale as Locale)) {
      segments[0] = locale;
    } else {
      segments.unshift(locale);
    }
    
    // localStorage.setItem('currentLocale', locale)
    
    router.push('/' + segments.join('/'));
  };

  const currentLocale = pathname.split('/')[1] as Locale || 'en';

  const pathnameLower = pathname.toLowerCase();
  const isAnalyzerRoute = pathnameLower.includes('/analyzer');
  
  return (
    <div className="flex gap-2 flex-wrap">
      {locales.map((locale) => (
        <button
          key={locale}
          onClick={() => switchLocale(locale)}
          disabled={isTranslating || disabled}
          className={`px-3 py-1.5 rounded text-sm transition-colors relative ${
            isTranslating || disabled
              ? 'opacity-50 cursor-not-allowed'
              : currentLocale === locale
              ? isAnalyzerRoute
                ? 'bg-blue-600 text-white font-medium shadow-md'
                : 'bg-white text-blue-600 font-medium shadow-md'
              : isAnalyzerRoute
                ? 'bg-gray-200 text-gray-700 hover:bg-gray-300 border border-gray-300'
                : 'bg-white/20 text-white hover:bg-white/30'
          }`}
        >
          {localeNames[locale]}
          {isTranslating && currentLocale === locale && (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
          )}
        </button>
      ))}
    </div>
  );
}
