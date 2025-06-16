// app/api/fal/proxy/route.js (最终确认版)

async function handler(request) {
  const targetUrl = request.headers.get('x-fal-target-url');
  if (!targetUrl) { return new Response('错误：缺少 x-fal-target-url 头', { status: 400 }); }
  const falKey = process.env.FAL_KEY;
  if (!falKey) { return new Response('错误：服务器未配置 FAL_KEY', { status: 500 }); }
  
  const contentType = request.headers.get('Content-Type');
  let body;
  if (contentType && contentType.includes('application/json')) {
      try {
          const requestData = await request.json();
          // [关键] 智能解包逻辑
          const unwrappedData = requestData.input || requestData;
          body = JSON.stringify(unwrappedData);
      } catch (e) { return new Response('错误：无法解析JSON', { status: 400 }); }
  } else { body = request.body; }
  
  const headers = new Headers(request.headers);
  headers.set('Authorization', `Key ${falKey}`);
  if (contentType && contentType.includes('application/json')) { headers.set('Content-Type', 'application/json'); }
  headers.delete('host');

  try {
    const response = await fetch(targetUrl, { method: request.method, headers: headers, body: body, signal: AbortSignal.timeout(60000) });
    return response;
  } catch (error) {
    console.error("代理请求失败:", error);
    if (error.name === 'TimeoutError') { return new Response('代理请求超时', { status: 504 }); }
    return new Response(error.message || '代理请求失败', { status: 500 });
  }
}

export { handler as GET, handler as POST };