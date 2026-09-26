import { NavLink } from 'react-router-dom'
import { ChatIcon, MapIcon,  UserIcon } from './icons'
import nearuLogo from '../assets/nearu-logo.png'

const items = [
  { to: '/map', label: '地図', Icon: MapIcon },
  { to: '/messages', label: 'メッセージ', Icon: ChatIcon },
  { to: '/mypage', label: 'マイページ', Icon: UserIcon },
]

export default function Sidebar() {
  return (
    <nav className="sidebar">
      <img
        className="sidebar__logo"
        src={nearuLogo}
        alt="Nearu"
      />
      <div className="sidebar__items">
        {items.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }: { isActive: boolean }) =>
              `sidebar__item${isActive ? ' is-active' : ''}`
            }
          >
            <Icon width={20} height={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
