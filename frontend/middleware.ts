import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n';

export default createMiddleware(routing as any);

export const config = {
  // Match only internationalized pathnames, exclude api routes including auth
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
