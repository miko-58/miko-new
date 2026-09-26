export type HelpType = 'come' | 'teach'

export type HelpCategory =
  | '移動'
  | '案内'
  | '子育て'
  | '荷物'
  | '言葉'
  | 'その他'

export interface HelpAuthor {
  id: string
  name: string
  avatarUrl?: string
}

export interface HelpPost {
  id: string
  title: string
  description: string
  category: HelpCategory
  type: HelpType
  distanceM: number
  postedMinutesAgo: number
  location: string
  imageUrl?: string
  author: HelpAuthor
}

export interface ChatMessage {
  id: string
  sender: 'me' | 'other'
  text: string
  time: string
}

export interface Conversation {
  helpId: string
  partner: HelpAuthor
  lastMessage: string
  lastMessageTime: string
  messages: ChatMessage[]
}

export interface UserProfile {
  name: string
  avatarUrl?: string
  helpedCount: number
  helpedByCount: number
  rating: number
}
