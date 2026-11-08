export default function middleware(request) {
  const { pathname } = new URL(request.url);
  if (pathname === '/lib' || pathname.startsWith('/lib/') || pathname === '/.data' || pathname.startsWith('/.data/')) {
    return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
  }
}

export const config = {
  matcher: ['/lib', '/lib/:path*', '/.data', '/.data/:path*'],
};
