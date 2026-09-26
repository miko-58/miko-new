import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { StarIcon } from '../components/icons'
import { useAuth } from '../contexts/AuthContext'
import { recordHelped } from '../lib/userProfile'

export default function Resolve() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')

  const sendResolution = async () => {
    if (isSending) return
    if (!user || !id) { setError('ログインと案件を確認してください。'); return }
    setIsSending(true)
    setError('')
    try {
      if (user && id) await recordHelped(user.uid, id)
      navigate('/map')
    } catch {
      setError('完了処理に失敗しました。時間をおいてもう一度お試しください。')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="screen screen--narrow resolve-screen">
      <div className="screen__scroll resolve-body">
        <div className="resolve-confetti" aria-hidden="true">🎉</div>
        <h1>Helpが解決しました！</h1>
        <p className="resolve-sub">
          助け合い、ありがとうございます。<br />
          よければ感想を教えてください。
        </p>

        <div className="resolve-avatar" aria-hidden="true">相</div>
        <p className="resolve-name">相手</p>
        <p className="resolve-help-title">このHelp</p>

        <div className="resolve-stars">
          {[1, 2, 3, 4, 5].map((number) => (
            <button
              key={number}
              type="button"
              aria-label={`${number}つ星`}
              onClick={() => setRating(number)}
              className="resolve-stars__btn"
            >
              <StarIcon filled={number <= rating} />
            </button>
          ))}
        </div>

        <textarea
          className="resolve-comment"
          placeholder="コメントを入力（任意）"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
      </div>

      <div className="screen__footer screen__footer--stacked">
        {error && <p role="alert">{error}</p>}
        <button type="button" className="btn btn--primary btn--block" onClick={() => void sendResolution()} disabled={isSending}>
          {isSending ? '送信中...' : '送信する'}
        </button>
        <button type="button" className="btn btn--text" onClick={() => navigate('/map')}>あとで</button>
      </div>
    </div>
  )
}
