import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ProveedorSesion, useSesion } from './lib/sesion'
import type { ReactNode } from 'react'

import Formulario from './publico/Formulario'
import CheckIn from './publico/CheckIn'
import Privacidad from './publico/Privacidad'
import Derechos from './publico/Derechos'
import Certificado from './publico/Certificado'
import NoEncontrado from './publico/NoEncontrado'

import MarcoAdmin from './admin/Marco'
import Ingreso from './admin/Ingreso'
import Panel from './admin/Panel'
import Constructor from './admin/Constructor'
import Inscripciones from './admin/Inscripciones'
import Asistencia from './admin/Asistencia'
import Indicadores from './admin/Indicadores'
import Calidad from './admin/Calidad'
import Padron from './admin/Padron'
import Extension from './admin/Extension'
import Certificados from './admin/Certificados'
import Proyectos from './admin/Proyectos'
import Proyecto from './admin/Proyecto'
import Ajustes from './admin/Ajustes'
import Usuarios from './admin/Usuarios'
import ImprimirConstancias from './admin/ImprimirConstancias'
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
  // `basename` toma la base del build: sirve tanto en la raíz de un dominio
  // propio como bajo /fcjysunida/ en un repositorio corriente.
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ProveedorSesion>
        <Routes>
          {/* Rutas públicas, sin cuenta */}
          <Route path="/f/:token" element={<Formulario />} />
          <Route path="/a/:token" element={<CheckIn />} />
          <Route path="/privacidad" element={<Privacidad />} />
          <Route path="/derechos" element={<Derechos />} />
          <Route path="/c/:codigo" element={<Certificado />} />
          <Route path="/c" element={<Certificado />} />

          {/* Panel */}
          <Route path="/admin"              element={<Protegido><Panel /></Protegido>} />
          <Route path="/admin/nueva"        element={<Protegido><Constructor /></Protegido>} />
          <Route path="/admin/inscripciones" element={<Protegido><Inscripciones /></Protegido>} />
          <Route path="/admin/asistencia"   element={<Protegido><Asistencia /></Protegido>} />
          <Route path="/admin/indicadores"  element={<Protegido><Indicadores /></Protegido>} />
          <Route path="/admin/calidad"      element={<Protegido><Calidad /></Protegido>} />
          <Route path="/admin/certificados" element={<Protegido><Certificados /></Protegido>} />
          <Route path="/admin/padron"       element={<Protegido><Padron /></Protegido>} />
          <Route path="/admin/extension"    element={<Protegido><Extension /></Protegido>} />
          <Route path="/admin/proyectos"    element={<Protegido><Proyectos /></Protegido>} />
          <Route path="/admin/proyectos/:id" element={<Protegido><Proyecto /></Protegido>} />
          <Route path="/admin/ajustes"      element={<Protegido><Ajustes /></Protegido>} />
          <Route path="/admin/usuarios"     element={<Protegido><Usuarios /></Protegido>} />
          <Route path="/admin/certificados/imprimir"
                 element={<Protegido><ImprimirConstancias /></Protegido>} />
          <Route path="/admin/seguridad"    element={<Protegido><Seguridad /></Protegido>} />

          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="*" element={<NoEncontrado />} />
        </Routes>
      </ProveedorSesion>
    </BrowserRouter>
  )
}
