import { NavLink } from 'react-router-dom'
import { ChatIcon, MapIcon, UserIcon } from './icons'

const items = [
  { to: '/map', label: '地図', Icon: MapIcon },
  { to: '/messages', label: 'メッセージ', Icon: ChatIcon },
  { to: '/mypage', label: 'マイページ', Icon: UserIcon },
]

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="メインナビゲーション">
      {items.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }: { isActive: boolean }) =>
            `bottom-nav__item${to === '/post/new' ? ' bottom-nav__item--post' : ''}${isActive ? ' is-active' : ''}`
          }
        >
          <Icon />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
