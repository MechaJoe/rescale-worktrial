import { Route, Routes } from 'react-router'

import { JobDetailPage } from './pages/JobDetailPage'
import { JobListPage } from './pages/JobListPage'
import { NotFoundPage } from './pages/NotFoundPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<JobListPage />} />
      <Route path="/jobs/:id" element={<JobDetailPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
