import type { HelpType } from '../types'

const labels: Record<HelpType, string> = {
  come: '来てほしい',
  teach: '教えてほしい',
}

export default function HelpTag({ type }: { type: HelpType }) {
  return <span className={`help-tag help-tag--${type}`}>{labels[type]}</span>
}
