import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Dashboard } from './pages/Dashboard'
import { NewProspect } from './pages/NewProspect'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/nuevo" element={<NewProspect />} />
      </Routes>
    </BrowserRouter>
  )
}
