export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const body = await req.json()

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
      },
      body: JSON.stringify(body),
    })

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text()
      return new Response(
        `data: ${JSON.stringify({ type: 'error', error: errText })}\n\n`,
        {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    // 스트리밍을 그대로 전달
    return new Response(anthropicRes.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (err) {
    return new Response(
      `data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`,
      {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
}
