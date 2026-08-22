export async function fetchUrlText(url: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'text/html,text/plain,*/*' },
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    const html = await res.text()
    const doc = new DOMParser().parseFromString(html, 'text/html')
    doc.querySelectorAll('script,style,noscript,nav,footer,header').forEach((el) => el.remove())
    // innerText is layout-dependent and always undefined in DOMParser — use textContent
    const text = (doc.body?.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim()
    if (!text) {
      throw new Error('Empty page')
    }
    return text.slice(0, 4000)
  } catch (err) {
    // Re-throw timeouts, HTTP errors, and empty-page errors as real errors
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out after 12 s')
    }
    if (err instanceof Error && (err.message.startsWith('HTTP') || err.message === 'Empty page')) {
      throw err
    }
    // Anything else is a network/CORS failure — signal the caller to fall back
    throw new Error('CORS_BLOCKED')
  } finally {
    clearTimeout(timer)
  }
}