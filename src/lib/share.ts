export interface ShareEnv {
  share?: (data: { title: string; url: string }) => Promise<void>
  clipboard?: { writeText: (text: string) => Promise<void> }
}

/** Opens the phone's share sheet if there is one, else copies the link. A cancelled share copies nothing. */
export async function shareOrCopy(url: string, env: ShareEnv): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  if (typeof env.share === 'function') {
    try {
      await env.share({ title: 'Our Life Planner', url })
      return 'shared'
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return 'cancelled'
    }
  }
  if (env.clipboard) {
    try {
      await env.clipboard.writeText(url)
      return 'copied'
    } catch {
      /* fall through */
    }
  }
  return 'failed'
}
