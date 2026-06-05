import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Dashboard } from './pages/Dashboard'
import { NewProspect } from './pages/NewProspect'
import { ProspectDetail } from './pages/ProspectDetail'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/nuevo" element={<NewProspect />} />
        <Route path="/prospectos/:id" element={<ProspectDetail />} />
      </Routes>
    </BrowserRouter>
  )
}
