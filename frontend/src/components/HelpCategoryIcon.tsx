import type { ReactNode } from 'react'
import type { HelpPost } from '../types'

type IconKind = 'stroller' | 'ticket' | 'train' | 'steps' | 'directions' | 'luggage' | 'language' | 'help'

const drawings: Record<IconKind, { label: string; shape: ReactNode }> = {
  stroller: { label: 'ベビーカー', shape: <><path d="M8 15h17a9 9 0 0 1-9 8h-1a8 8 0 0 1-7-8Zm8 0V5a10 10 0 0 1 10 10M8 15 5 9H2M12 23l-2 3m11-3 2 3" /><circle cx="10" cy="27" r="2" /><circle cx="24" cy="27" r="2" /></> },
  ticket: { label: '切符・券売機', shape: <><path d="M5 8h22v6a3 3 0 0 0 0 6v5H5v-5a3 3 0 0 0 0-6V8Z" /><path d="M21 9v2m0 4v2m0 4v2M10 13h6m-6 6h4" /></> },
  train: { label: '電車', shape: <><rect x="7" y="4" width="18" height="22" rx="5" /><path d="M7 16h18M16 8v8M12 8h8M11 26l-3 4m13-4 3 4M10 29h12" /><circle cx="12" cy="21" r="1" /><circle cx="20" cy="21" r="1" /></> },
  steps: { label: '階段・段差', shape: <><path d="M3 27h8v-7h8v-7h9V5M4 17 20 3M4 12v5h5" /></> },
  directions: { label: '道案内', shape: <><path d="M16 3v27M5 7h17l5 5-5 5H5V7Zm11 14H9l-5 4 5 4h7" /></> },
  luggage: { label: '荷物', shape: <><rect x="7" y="9" width="18" height="18" rx="3" /><path d="M12 9V5h8v4M12 14v8m8-8v8M11 27v3m10-3v3" /></> },
  language: { label: '言葉・会話', shape: <><path d="M5 5h22v17H14l-7 5v-5H5V5ZM10 11h12m-12 5h8" /></> },
  help: { label: 'その他のヘルプ', shape: <><circle cx="16" cy="16" r="12" /><path d="M12 12a4 4 0 0 1 8 0c0 3-4 3-4 6m0 5h.01" /></> },
}

function chooseIcon(help: Pick<HelpPost, 'category' | 'title' | 'description'>): IconKind {
  const text = help.title + ' ' + help.description
  if (/ベビーカー|乳母車|赤ちゃん/.test(text)) return 'stroller'
  if (/切符|きっぷ|券売機|乗車券/.test(text)) return 'ticket'
  if (/階段|段差|階段昇降/.test(text)) return 'steps'
  if (/電車|列車|地下鉄|新幹線|改札|ホーム/.test(text)) return 'train'
  if (/道案内|道に迷|行き方|道順/.test(text)) return 'directions'
  switch (help.category) {
    case '子育て': return 'stroller'
    case '移動': return 'steps'
    case '案内': return 'directions'
    case '荷物': return 'luggage'
    case '言葉': return 'language'
    default: return 'help'
  }
}

export default function HelpCategoryIcon({ help }: { help: Pick<HelpPost, 'category' | 'title' | 'description'> }) {
  const kind = chooseIcon(help)
  const { label, shape } = drawings[kind]
  return (
    <span className={`help-category-icon help-category-icon--${kind}`}>
      <svg width="42" height="42" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={label}>
        {shape}
      </svg>
    </span>
  )
}

