import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import GalleryPage from './pages/GalleryPage'
import AnimalPage from './pages/AnimalPage'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ListingFormPage from './pages/ListingFormPage'
import ModerationPage from './pages/ModerationPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<GalleryPage />} />
          <Route path="animals/:id" element={<AnimalPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="dashboard/new" element={<ProtectedRoute><ListingFormPage /></ProtectedRoute>} />
          <Route path="dashboard/edit/:id" element={<ProtectedRoute><ListingFormPage /></ProtectedRoute>} />
          <Route path="moderation" element={<ProtectedRoute moderator><ModerationPage /></ProtectedRoute>} />
          <Route path="*" element={<div className="container not-found"><h1>Page not found</h1><a className="button" href="/">Go home</a></div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
