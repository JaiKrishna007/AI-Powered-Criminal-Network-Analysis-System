export async function handleProxyOrFallback(
  request: Request,
  backendPath: string,
  fallbackCallback: () => Promise<any> | any
): Promise<Response> {
  const backendUrl = process.env.BACKEND_URL;
  if (backendUrl) {
    try {
      const url = new URL(request.url);
      const targetUrl = `${backendUrl.replace(/\/$/, '')}${backendPath}${url.search}`;
      
      const headers = new Headers();
      request.headers.forEach((value, key) => {
        headers.set(key, value);
      });
      // Prevent forwarding host header to avoid naming mismatch/invalid certificates
      headers.delete('host');

      let body: string | undefined = undefined;
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        try {
          body = await request.clone().text();
        } catch (e) {
          // No body or error reading it
        }
      }

      const response = await fetch(targetUrl, {
        method: request.method,
        headers,
        body,
        cache: 'no-store'
      });

      const responseData = await response.text();
      let parsedData;
      try {
        parsedData = JSON.parse(responseData);
      } catch (e) {
        parsedData = responseData;
      }

      return new Response(
        typeof parsedData === 'string' ? parsedData : JSON.stringify(parsedData),
        {
          status: response.status,
          headers: {
            'Content-Type': response.headers.get('content-type') || 'application/json',
          }
        }
      );
    } catch (err) {
      console.error(`[Proxy] Connection failed to ${backendUrl}${backendPath}, falling back to mock data:`, err);
    }
  }

  // Fallback to local mock data
  const result = await fallbackCallback();
  if (result instanceof Response) {
    return result;
  }
  return Response.json(result);
}
