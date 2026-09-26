import type { Conversation, HelpPost, UserProfile } from '../types'

// 開発用の見本データは常に空にする。
// 画面には Firestore に保存された実際のテスト投稿だけを表示する。
export const mockHelps: HelpPost[] = []

export const mockConversations: Conversation[] = []

export const mockUser: UserProfile = {
  name: 'あなた',
  helpedCount: 0,
  helpedByCount: 0,
  rating: 0,
}
