import { useNavigate } from 'react-router-dom'
import { BackIcon, CloseIcon } from './icons'

interface TopBarProps {
  title: string
  onClose?: boolean
  right?: React.ReactNode
}

export default function TopBar({ title, onClose, right }: TopBarProps) {
  const navigate = useNavigate()

  return (
    <header className="top-bar">
      <button
        type="button"
        className="top-bar__icon-btn"
        onClick={() => navigate(-1)}
        aria-label="戻る"
      >
        {onClose ? <CloseIcon /> : <BackIcon />}
      </button>
      <h1 className="top-bar__title">{title}</h1>
      <div className="top-bar__right">{right}</div>
    </header>
  )
}
