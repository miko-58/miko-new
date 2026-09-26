import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import MapView from './pages/MapView'
import Messages from './pages/Messages'
import Chat from './pages/Chat'
import Resolve from './pages/Resolve'
import MyPage from './pages/MyPage'
import { useAuth } from './contexts/AuthContext'
import Login from './pages/Login'

function AppLayout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell__main">
        <Outlet />
      </div>
    </div>
  )
}

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return <p>読み込み中...</p>
  }

  if (!user) {
    return <Login />
  }
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/map" replace />} />
        <Route element={<AppLayout />}>
          <Route path="/map" element={<MapView />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/help/:id/chat" element={<Chat />} />
          <Route path="/help/:id/resolve" element={<Resolve />} />
          <Route path="/mypage" element={<MyPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
