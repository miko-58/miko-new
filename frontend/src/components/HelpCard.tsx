import HelpCategoryIcon from './HelpCategoryIcon'
import { Link } from 'react-router-dom'
import type { HelpPost } from '../types'
import HelpTag from './HelpTag'
import { ClockIcon, LocationIcon } from './icons'

export default function HelpCard({ help }: { help: HelpPost }) {
  const minutes = help.postedMinutesAgo
  const elapsed = minutes < 1 ? 'たった今' : minutes < 60 ? `${minutes}分前` : minutes < 1440 ? `${Math.floor(minutes / 60)}時間前` : `${Math.floor(minutes / 1440)}日前`
  return (
    <Link className="help-card" to={`/help/${help.id}`}>
      <div className="help-card__thumb">
        {help.imageUrl ? <img className="help-card__photo" src={help.imageUrl} alt="投稿された状況の写真" loading="lazy" /> : <HelpCategoryIcon help={help} />}
      </div>
      <div className="help-card__body">
        <span className="help-card__category">{help.category}</span>
        <h3 className="help-card__title">{help.title}</h3>
        <p className="help-card__meta"><span><LocationIcon width={13} height={13} />{help.distanceM > 0 ? `${help.distanceM}m先` : '距離未取得'}</span><span><ClockIcon width={13} height={13} />{elapsed}</span></p>
        <HelpTag type={help.type} />
      </div>
    </Link>
  )
}
