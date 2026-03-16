export const AUTH_COOKIE_NAME = "plt_token";

export function hashPassword(password: string): string {
  return new Bun.CryptoHasher("sha256").update(password).digest("hex");
}

export function isAuthenticated(req: Request, password: string): boolean {
  const auth = req.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ") && auth.slice(7) === password) {
    return true;
  }

  const cookie = req.headers.get("cookie") || "";
  const token = parseCookie(cookie, AUTH_COOKIE_NAME);
  if (token && token === hashPassword(password)) {
    return true;
  }

  // Query param token (useful for WebSocket clients that can't set headers)
  const url = new URL(req.url);
  const queryToken = url.searchParams.get("token");
  if (queryToken && queryToken === password) {
    return true;
  }

  return false;
}

function parseCookie(cookieHeader: string, name: string): string | null {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function loginPage(error = false): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Login - PBXware Live Transcription</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace; background: #0d1117; color: #c9d1d9; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .login { background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 32px; width: 100%; max-width: 360px; }
    .login h1 { font-size: 18px; color: #f0f6fc; margin-bottom: 24px; text-align: center; }
    .login input { width: 100%; padding: 10px 12px; background: #0d1117; border: 1px solid #30363d; border-radius: 6px; color: #c9d1d9; font-size: 14px; margin-bottom: 16px; }
    .login input:focus { outline: none; border-color: #58a6ff; }
    .login button { width: 100%; padding: 10px; background: #238636; color: #fff; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; font-weight: 600; }
    .login button:hover { background: #2ea043; }
    .error { color: #f85149; font-size: 13px; margin-bottom: 12px; text-align: center; }
  </style>
</head>
<body>
  <form class="login" method="POST" action="/login">
    <h1>PBXware Live Transcription</h1>
    ${error ? '<p class="error">Invalid password</p>' : ""}
    <input type="password" name="password" placeholder="Password" autofocus required>
    <button type="submit">Log in</button>
  </form>
</body>
</html>`;
}
