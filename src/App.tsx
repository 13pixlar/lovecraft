import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { PlayerProvider } from '@/context/PlayerContext'
import { BookmarksPage } from '@/pages/BookmarksPage'
import { HomePage } from '@/pages/HomePage'
import { WorkPage } from '@/pages/WorkPage'

export default function App() {
  return (
    <BrowserRouter>
      <PlayerProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/verk/:slug" element={<WorkPage />} />
            <Route path="/bokmarken" element={<BookmarksPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </PlayerProvider>
    </BrowserRouter>
  )
}
