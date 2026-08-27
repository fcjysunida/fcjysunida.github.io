import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ProveedorSesion, useSesion } from './lib/sesion'
import type { ReactNode } from 'react'

import Formulario from './publico/Formulario'
import CheckIn from './publico/CheckIn'
import Privacidad from './publico/Privacidad'
import Derechos from './publico/Derechos'
import NoEncontrado from './publico/NoEncontrado'

import MarcoAdmin from './admin/Marco'
import Ingreso from './admin/Ingreso'
import Panel from './admin/Panel'
import Constructor from './admin/Constructor'
import Inscripciones from './admin/Inscripciones'
import Asistencia from './admin/Asistencia'
import Indicadores from './admin/Indicadores'
import Calidad from './admin/Calidad'
import Seguridad from './admin/Seguridad'
import { Cargando } from './ui/piezas'

function Protegido({ children }: { children: ReactNode }) {
  const { sesion, rol, cargando } = useSesion()
  if (cargando) {
    return <div style={{ padding: 48 }}><Cargando texto="Verificando la sesión" /></div>
  }
  if (!sesion) return <Ingreso />
  if (!rol) return <Ingreso sinRol />
  return <MarcoAdmin>{children}</MarcoAdmin>
}

export default function App() {
  return (
    <BrowserRouter>
      <ProveedorSesion>
        <Routes>
          {/* Rutas públicas, sin cuenta */}
          <Route path="/f/:token" element={<Formulario />} />
          <Route path="/a/:token" element={<CheckIn />} />
          <Route path="/privacidad" element={<Privacidad />} />
          <Route path="/derechos" element={<Derechos />} />

          {/* Panel */}
          <Route path="/admin"              element={<Protegido><Panel /></Protegido>} />
          <Route path="/admin/nueva"        element={<Protegido><Constructor /></Protegido>} />
          <Route path="/admin/inscripciones" element={<Protegido><Inscripciones /></Protegido>} />
          <Route path="/admin/asistencia"   element={<Protegido><Asistencia /></Protegido>} />
          <Route path="/admin/indicadores"  element={<Protegido><Indicadores /></Protegido>} />
          <Route path="/admin/calidad"      element={<Protegido><Calidad /></Protegido>} />
          <Route path="/admin/seguridad"    element={<Protegido><Seguridad /></Protegido>} />

          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="*" element={<NoEncontrado />} />
        </Routes>
      </ProveedorSesion>
    </BrowserRouter>
  )
}
