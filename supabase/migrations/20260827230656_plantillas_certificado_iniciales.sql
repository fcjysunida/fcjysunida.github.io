-- Plantillas iniciales, calcadas de las que se usaban con Autocrat.
-- Etiquetas disponibles (misma sintaxis <<Etiqueta>>):
--   <<Nombres>> <<Apellido>> <<NombreCompleto>> <<Evento>> <<Fecha>> <<Horas>>
--   <<Rol>> <<Modalidad>> <<Lugar>> <<Codigo>> <<Jornadas>> <<FechaEmision>>

insert into public.certificado_plantillas (nombre, rol, cuerpo_html, orientacion)
values
('Constancia de participación', 'participante',
$$<section class="cert">
  <p class="cert-encabezado">La Facultad de Ciencias Jurídicas y Sociales<br>de la Universidad de la Integración de las Américas</p>
  <p class="cert-otorga">otorga la presente constancia a</p>
  <h1 class="cert-nombre">&lt;&lt;Nombres&gt;&gt; &lt;&lt;Apellido&gt;&gt;</h1>
  <p class="cert-cuerpo">por su participación en</p>
  <h2 class="cert-evento">&lt;&lt;Evento&gt;&gt;</h2>
  <p class="cert-datos">&lt;&lt;Fecha&gt;&gt; &middot; &lt;&lt;Horas&gt;&gt; horas &middot; &lt;&lt;Modalidad&gt;&gt;</p>
  <p class="cert-pie">Código de verificación &lt;&lt;Codigo&gt;&gt;</p>
</section>$$,
 'horizontal'),

('Constancia con rol', null,
$$<section class="cert">
  <p class="cert-encabezado">La Facultad de Ciencias Jurídicas y Sociales<br>de la Universidad de la Integración de las Américas</p>
  <p class="cert-otorga">otorga la presente constancia a</p>
  <h1 class="cert-nombre">&lt;&lt;Nombres&gt;&gt; &lt;&lt;Apellido&gt;&gt;</h1>
  <p class="cert-cuerpo">en calidad de <strong>&lt;&lt;Rol&gt;&gt;</strong> en</p>
  <h2 class="cert-evento">&lt;&lt;Evento&gt;&gt;</h2>
  <p class="cert-datos">&lt;&lt;Fecha&gt;&gt; &middot; &lt;&lt;Horas&gt;&gt; horas &middot; &lt;&lt;Modalidad&gt;&gt;</p>
  <p class="cert-pie">Código de verificación &lt;&lt;Codigo&gt;&gt;</p>
</section>$$,
 'horizontal');;
