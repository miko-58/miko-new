import type { User } from 'firebase/auth'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'

export async function uploadHelpPhoto(user: User, file: File) {
  const token = await user.getIdToken()
  const body = new FormData()
  body.append('photo', file)
  const response = await fetch(`${apiBaseUrl}/api/photos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  })
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(detail?.error || `写真を保存できませんでした（HTTP ${response.status}）`)
  }
  return response.json() as Promise<{ blobName: string; imageUrl: string }>
}
