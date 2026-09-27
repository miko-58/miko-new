import type { User } from 'firebase/auth'

// 空なら同一オリジンの /api を使う。スマホでPCの開発サーバーを開いたときも、
// localhost（スマホ自身）ではなくViteのプロキシ経由でバックエンドに届く。
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? ''

export async function uploadHelpPhoto(user: User, file: File) {
  const token = await user.getIdToken()
  const body = new FormData()
  body.append('photo', file)
  let response: Response
  try {
    response = await fetch(`${apiBaseUrl}/api/photos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body,
    })
  } catch {
    throw new Error('写真保存サーバーに接続できません。プロジェクト直下で npm run dev を起動してください。')
  }
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(detail?.error || `写真を保存できませんでした（HTTP ${response.status}）`)
  }
  return response.json() as Promise<{ blobName: string; imageUrl: string }>
}
