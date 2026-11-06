/** Parse framed SSE across arbitrary UTF-8 and CRLF network chunk boundaries. */
export async function* readEvents(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  function parse(frame: string): { event: string; data: string } | null {
    const lines = frame.split(/\r?\n/);
    const data = lines.filter((line) => line.startsWith('data:')).map((line) => line.slice(5).replace(/^ /, '')).join('\n');
    if (!data) return null;
    return { event: lines.find((line) => line.startsWith('event:'))?.slice(6).trim() || 'message', data };
  }
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      if (buffer.length > 262_144) throw new Error('Stream frame exceeds the allowed size');
      let match: RegExpExecArray | null;
      while ((match = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        const event = parse(frame); if (event) yield event;
      }
      if (done) { const event = parse(buffer); if (event) yield event; break; }
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
