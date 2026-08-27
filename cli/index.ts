#!/usr/bin/env tsx
/**
 * Operación del sistema desde la línea de comandos.
 *
 * La sesión es la de una persona con su rol, no el service_role: así cada
 * acción queda atribuida en el registro de auditoría. Las dos excepciones
 * —alta de usuarios y creación de claves del Vault— lo dicen explícitamente.
 */
import { writeFileSync } from 'node:fs'
import { argumentos, exigir, fatal, comoOperador, comoServicio, tabla } from './comun'
import { informeMarkdown, informeDocx } from './informe'
import type { DatosInforme } from './informe'

const [, , comando = '', ...resto] = process.argv
const args = argumentos(resto)

const AYUDA = `
  fcjysunida — operación del sistema de inscripciones y asistencia

  Actividades
    actividad:crear --titulo "..." --tipo extension --inicio 2026-09-15 --dias 2
                    [--modalidad hibrida] [--cupo 120] [--lugar "..."] [--horas 8]
                    [--descripcion "..."] [--portada juridico]
    actividad:listar
    actividad:enlaces --id <uuid>
    actividad:regenerar-enlace --id <uuid>          # invalida el anterior y rota los códigos
    actividad:regenerar-codigo --id <uuid> --dia 2
    actividad:cerrar --id <uuid> [--finalizada]

  Campos del formulario
    campos:listar --actividad <uuid>

  Inscripciones
    inscripciones:listar --actividad <uuid>         # cédula enmascarada
    inscripciones:exportar --actividad <uuid> --motivo "certificación" [--con-cedula]
    inscripciones:editar --id <uuid> --campo estado --valor anulada

  Calidad
    calidad:ver --actividad <uuid>                  # CSAT, NPS y dimensiones

  Informe DTC
    informe:dtc --mes 2026-08 --docente "Nombre Apellido" [--formato docx|md|csv]

  Retención
    retencion:aplicar [--meses 24] [--dry-run]

  Puesta en marcha (usan SUPABASE_SERVICE_ROLE_KEY)
    claves:inicializar
    usuarios:alta --email ... --nombre "..." --rol admin|coordinacion|docente|secretaria|auditor
`

async function main(): Promise<void> {
  switch (comando) {
    // ── Actividades ──────────────────────────────────────────────────────────
    case 'actividad:crear': {
      const [titulo, tipo, inicio] = exigir(args, 'titulo', 'tipo', 'inicio')
      const db = await comoOperador()
      const { data, error } = await db.rpc('crear_actividad', {
        p_titulo: titulo,
        p_tipo: tipo,
        p_modalidad: (args.modalidad as string) ?? 'presencial',
        p_inicio: inicio,
        p_dias: Number(args.dias ?? 1),
        p_cupo: Number(args.cupo ?? 0),
        p_lugar: (args.lugar as string) ?? null,
        p_descripcion: (args.descripcion as string) ?? null,
        p_portada: (args.portada as string) ?? 'juridico',
        p_portada_credito: null,
        p_campos: camposHabituales(),
        p_horas: Number(args.horas ?? 0),
      })
      if (error) fatal(error.message)
      const e = data as Enlaces
      console.log(`\n  Actividad creada: ${e.titulo}\n`)
      console.log(`  Inscripción  ${base()}/f/${e.token_formulario}`)
      console.log(`  Asistencia   ${base()}/a/${e.token_asistencia}\n`)
      tabla(e.jornadas.map((j) => ({ jornada: j.numero, fecha: j.fecha, codigo: j.codigo })))
      break
    }

    case 'actividad:listar': {
      const db = await comoOperador()
      const { data, error } = await db
        .from('actividades_resumen')
        .select('id, titulo, tipo, fecha_inicio, dias, cupo, inscriptos, asistencias, evaluaciones, estado')
        .order('fecha_inicio', { ascending: false })
      if (error) fatal(error.message)
      tabla((data ?? []) as Record<string, unknown>[])
      break
    }

    case 'actividad:enlaces': {
      const [id] = exigir(args, 'id')
      const db = await comoOperador()
      const { data, error } = await db.rpc('enlaces_de', { p_actividad: id })
      if (error) fatal(error.message)
      mostrarEnlaces(data as Enlaces)
      break
    }

    case 'actividad:regenerar-enlace': {
      const [id] = exigir(args, 'id')
      const db = await comoOperador()
      const { data, error } = await db.rpc('regenerar_enlace', { p_actividad: id })
      if (error) fatal(error.message)
      console.log('\n  El enlace anterior quedó invalidado y todos los códigos rotaron.')
      mostrarEnlaces(data as Enlaces)
      break
    }

    case 'actividad:regenerar-codigo': {
      const [id, dia] = exigir(args, 'id', 'dia')
      const db = await comoOperador()
      const { data, error } = await db.rpc('regenerar_codigo', {
        p_actividad: id, p_jornada: Number(dia),
      })
      if (error) fatal(error.message)
      mostrarEnlaces(data as Enlaces)
      break
    }

    case 'actividad:cerrar': {
      const [id] = exigir(args, 'id')
      const db = await comoOperador()
      const { error } = await db.rpc('cerrar_actividad', {
        p_actividad: id, p_finalizada: args['finalizada'] === true,
      })
      if (error) fatal(error.message)
      console.log(`\n  Actividad ${args['finalizada'] === true ? 'finalizada' : 'cerrada'}.\n`)
      break
    }

    // ── Campos ───────────────────────────────────────────────────────────────
    case 'campos:listar': {
      const [actividad] = exigir(args, 'actividad')
      const db = await comoOperador()
      const { data, error } = await db
        .from('actividades_resumen').select('campos').eq('id', actividad).single()
      if (error) fatal(error.message)
      const campos = (data as { campos: Campo[] }).campos
      tabla(campos.map((c, i) => ({
        '#': i + 1, etiqueta: c.etiqueta, tipo: c.tipo,
        obligatorio: c.obligatorio ? 'sí' : '', cifrado: c.cifrado ? 'sí' : '',
        sensible: c.sensible ? 'sí' : '', mapa: c.mapa ?? '',
      })))
      console.log('\n  Los campos se editan desde el constructor del panel: /admin/nueva\n')
      break
    }

    // ── Inscripciones ────────────────────────────────────────────────────────
    case 'inscripciones:listar': {
      const [actividad] = exigir(args, 'actividad')
      const db = await comoOperador()
      const { data, error } = await db
        .from('inscripciones_panel')
        .select('nombre, cedula_mascara, email, condicion, institucion, estado, jornadas_asistidas')
        .eq('actividad_id', actividad).order('nombre')
      if (error) fatal(error.message)
      tabla((data ?? []) as Record<string, unknown>[])
      break
    }

    case 'inscripciones:exportar': {
      const [actividad, motivo] = exigir(args, 'actividad', 'motivo')
      const db = await comoOperador()
      const { data, error } = await db.rpc('exportar_inscripciones', {
        p_actividad: actividad, p_motivo: motivo,
        p_incluir_cedula: args['con-cedula'] === true,
      })
      if (error) fatal(error.message)
      const filas = (data ?? []) as Record<string, unknown>[]
      if (filas.length === 0) fatal('No hay inscripciones para exportar.')
      const ruta = (args.salida as string) ?? `inscripciones-${actividad.slice(0, 8)}.csv`
      writeFileSync(ruta, aCSV(filas), 'utf8')
      console.log(`\n  ${filas.length} inscripciones en ${ruta}`)
      console.log(`  La exportación quedó asentada en auditoría con el motivo declarado.\n`)
      break
    }

    case 'inscripciones:editar': {
      const [id, campo, valor] = exigir(args, 'id', 'campo', 'valor')
      if (!['nombre', 'email', 'estado'].includes(campo)) {
        fatal('Solo se editan por línea de comandos: nombre, email, estado.')
      }
      const db = await comoOperador()
      const { error } = await db.from('inscripciones').update({ [campo]: valor }).eq('id', id)
      if (error) fatal(error.message)
      await db.rpc('auditar', {
        p_accion: 'edicion_inscripcion', p_entidad: 'inscripciones', p_entidad_id: id,
        p_motivo: (args.motivo as string) ?? null, p_detalle: { [campo]: valor },
      })
      console.log(`\n  Inscripción actualizada: ${campo} = ${valor}\n`)
      break
    }

    // ── Calidad ──────────────────────────────────────────────────────────────
    case 'calidad:ver': {
      const [actividad] = exigir(args, 'actividad')
      const db = await comoOperador()
      const { data, error } = await db.rpc('satisfaccion_de', { p_actividad: actividad })
      if (error) fatal(error.message)
      const s = data as Record<string, unknown>
      if (Number(s.respuestas ?? 0) === 0) {
        console.log('\n  Todavía no hay evaluaciones para esta actividad.\n')
        break
      }
      tabla([s])
      break
    }

    // ── Informe DTC ──────────────────────────────────────────────────────────
    case 'informe:dtc': {
      const [mes, docente] = exigir(args, 'mes', 'docente')
      const db = await comoOperador()
      const { data, error } = await db.rpc('indicadores', { p_periodo: mes })
      if (error) fatal(error.message)
      const ind = data as { bloques: DatosInforme['bloques']; calidad: DatosInforme['calidad'] }
      const datos: DatosInforme = {
        periodo: mes, docente,
        mes: new Date(mes + '-01T12:00:00').toLocaleDateString('es-PY',
          { month: 'long', year: 'numeric', timeZone: 'America/Asuncion' }),
        bloques: ind.bloques, calidad: ind.calidad,
      }
      const formato = (args.formato as string) ?? 'docx'
      if (formato === 'docx') {
        const ruta = (args.salida as string) ?? `informe-dtc-${mes}.docx`
        await informeDocx(datos, ruta)
        console.log(`\n  ${ruta}\n`)
      } else if (formato === 'md') {
        const ruta = (args.salida as string) ?? `informe-dtc-${mes}.md`
        writeFileSync(ruta, informeMarkdown(datos), 'utf8')
        console.log(`\n  ${ruta}\n`)
      } else if (formato === 'csv') {
        const filas = datos.bloques.flatMap((b) => b.items.map((it) => ({
          bloque: `${b.n}. ${b.titulo}`, indicador: it.label,
          valor: it.valor, unidad: it.unidad, origen: it.origen,
        })))
        const ruta = (args.salida as string) ?? `informe-dtc-${mes}.csv`
        writeFileSync(ruta, aCSV(filas), 'utf8')
        console.log(`\n  ${ruta}\n`)
      } else {
        fatal('Formato no reconocido. Use docx, md o csv.')
      }
      break
    }

    // ── Retención ────────────────────────────────────────────────────────────
    case 'retencion:aplicar': {
      const db = await comoOperador()
      const simulacion = args['dry-run'] === true
      const { data, error } = await db.rpc('aplicar_retencion', {
        p_meses: Number(args.meses ?? 24), p_simulacion: simulacion,
      })
      if (error) fatal(error.message)
      const r = data as Record<string, unknown>
      console.log(simulacion
        ? `\n  Simulación: ${r.alcanzadas} inscripciones alcanzadas por el plazo de ${r.meses} meses.\n`
        : `\n  Se anonimizaron ${r.anonimizadas} inscripciones y se eliminaron sus datos sensibles.\n`)
      break
    }

    // ── Puesta en marcha ─────────────────────────────────────────────────────
    case 'claves:inicializar': {
      const db = comoServicio()
      const { data, error } = await db.rpc('claves_inicializar')
      if (error) {
        fatal('Falta la función claves_inicializar. Aplique las migraciones primero:\n' +
              '    supabase db push')
      }
      console.log(`\n  ${String(data)}\n`)
      break
    }

    case 'usuarios:alta': {
      const [email, nombre, rol] = exigir(args, 'email', 'nombre', 'rol')
      const db = comoServicio()
      // La contraseña temporal se genera acá y se muestra una sola vez: no se
      // guarda en ningún archivo ni viaja por correo desde el sistema.
      const provisoria = (args.clave as string) ?? claveProvisoria()
      const { data, error } = await db.auth.admin.createUser({
        email, password: provisoria, email_confirm: true,
      })
      if (error) fatal(error.message)
      const { error: e2 } = await db.from('usuarios')
        .insert({ id: data.user.id, nombre, email, rol })
      if (e2) fatal(e2.message)
      console.log(`\n  Alta de ${nombre} (${email}) con rol «${rol}».`)
      console.log(`  Contraseña provisoria: ${provisoria}`)
      console.log('  Entréguela por un canal seguro y pídale que la cambie en el primer ingreso.\n')
      break
    }

    default:
      console.log(AYUDA)
      if (comando !== '' && comando !== '--help' && comando !== '-h') process.exit(1)
  }
}

// ── Auxiliares ────────────────────────────────────────────────────────────────
interface Enlaces {
  id: string
  titulo: string
  token_formulario: string
  token_asistencia: string
  jornadas: { numero: number; fecha: string; codigo: string; presentes: number }[]
}
interface Campo {
  etiqueta: string; tipo: string
  obligatorio?: boolean; cifrado?: boolean; sensible?: boolean; mapa?: string
}

const base = () => process.env.FCJYS_BASE ?? 'https://fcjysunida.github.io'

function mostrarEnlaces(e: Enlaces): void {
  console.log(`\n  ${e.titulo}\n`)
  console.log(`  Inscripción  ${base()}/f/${e.token_formulario}`)
  console.log(`  Asistencia   ${base()}/a/${e.token_asistencia}\n`)
  tabla(e.jornadas.map((j) => ({
    jornada: j.numero, fecha: j.fecha, codigo: j.codigo, presentes: j.presentes,
  })))
}

function aCSV(filas: Record<string, unknown>[]): string {
  const cab = Object.keys(filas[0]!)
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  return '﻿' + [
    cab.join(','), ...filas.map((f) => cab.map((c) => esc(f[c])).join(',')),
  ].join('\r\n')
}

function claveProvisoria(): string {
  const abc = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 16 }, () => abc[Math.floor(Math.random() * abc.length)]).join('')
}

/** Mismo conjunto que ofrece el constructor del panel. */
function camposHabituales(): Record<string, unknown>[] {
  const id = () => 'c' + Math.random().toString(36).slice(2, 8)
  return [
    { id: id(), tipo: 'texto', etiqueta: 'Nombre y apellido', obligatorio: true, mapa: 'nombre',
      ayuda: 'Tal como debe figurar en el certificado' },
    { id: id(), tipo: 'cedula', etiqueta: 'Cédula de identidad', obligatorio: true, cifrado: true,
      mapa: 'cedula', ayuda: 'Se utiliza para validar su asistencia. Se almacena cifrada.' },
    { id: id(), tipo: 'email', etiqueta: 'Correo electrónico', obligatorio: true, mapa: 'email',
      ayuda: 'Allí se envían la confirmación y el certificado' },
    { id: id(), tipo: 'tel', etiqueta: 'Teléfono o WhatsApp', cifrado: true, mapa: 'telefono' },
    { id: id(), tipo: 'unica', etiqueta: 'Condición', obligatorio: true, mapa: 'condicion',
      opciones: ['Estudiante', 'Docente', 'Egresado', 'Externo'] },
    { id: id(), tipo: 'texto', etiqueta: 'Institución u organización', mapa: 'institucion' },
    { id: id(), tipo: 'texto', etiqueta: 'Carrera y semestre', mapa: 'carrera' },
    { id: id(), tipo: 'texto', etiqueta: 'Ciudad o departamento', mapa: 'ciudad' },
    { id: id(), tipo: 'unica', etiqueta: 'Modalidad de participación', obligatorio: true,
      mapa: 'modalidad', opciones: ['Presencial', 'Virtual'] },
    { id: id(), tipo: 'unica', etiqueta: '¿Necesita certificado?', mapa: 'certificado',
      opciones: ['Sí', 'No'] },
    { id: id(), tipo: 'parrafo', etiqueta: 'Requerimientos de accesibilidad', sensible: true,
      mapa: 'accesibilidad',
      ayuda: 'Dato sensible. Es voluntario. Solo lo consulta la organización de la actividad.' },
    { id: id(), tipo: 'lista', etiqueta: '¿Cómo se enteró de la actividad?', mapa: 'origen_difusion',
      opciones: ['Instagram', 'Correo institucional', 'WhatsApp', 'Recomendación', 'Otro medio'] },
  ]
}

main().catch((e: Error) => fatal(e.message))
