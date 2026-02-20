export const LANGUAGE_NAMES: Record<string, string> = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'hi': 'Hindi'
  };
  
  export const getLanguageName = (locale: string): string => {
    return LANGUAGE_NAMES[locale] || locale.toUpperCase();
  };