import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { IN_ARTIFACT } from './platform/runtime'
import { ArtifactBoot } from './platform/ArtifactBoot'

createRoot(document.getElementById('root')!).render(
  <StrictMode>{IN_ARTIFACT ? <ArtifactBoot /> : <App />}</StrictMode>,
)
