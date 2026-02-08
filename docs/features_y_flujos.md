# Documentación de Funcionalidades y Flujos de Usuario

## Feature 1: Inicio de Sesión y Autenticación
- **Nombre:** Autenticación de Usuario (Login)
- **Qué hace (1 frase):** Permite el acceso seguro al dashboard de gestión mediante credenciales de correo y contraseña.
- **Beneficio para el usuario:** Garantiza que solo el personal autorizado pueda modificar los contenidos y configuraciones de las pantallas de la empresa.
- **Ejemplo de uso real:** El administrador de marketing ingresa sus datos al iniciar el día para actualizar las promociones.
- **Nivel de importancia:** Clave (Key)

### C. Flujo de uso (si aplica)
**¿Cómo empieza el usuario?**
El usuario navega a la URL de la plataforma (dashboard) y no tiene una sesión activa.

**¿Qué pasos sigue?**
1. Ingresa su correo electrónico y contraseña en el formulario de inicio de sesión.
2. Presiona el botón "Iniciar Sesión" (Sign In).
3. (Opcional) Si las credenciales son incorrectas, recibe un mensaje de error y reintenta.

**¿Qué ve en pantalla?**
- Pantalla inicial: Formulario limpio con campos para email y password.
- Al ingresar: Redirección inmediata al Dashboard Principal (Overview) mostrando el resumen de dispositivos y estado del sistema.

---

## Feature 2: Emparejamiento de Dispositivos (Device Pairing)
- **Nombre:** Registro de Nuevo Reproductor
- **Qué hace (1 frase):** Vincula un reproductor Raspberry Pi físico con la cuenta del usuario mediante un código único.
- **Beneficio para el usuario:** Facilita la expansión de la red de pantallas sin requerir configuración técnica avanzada en el sitio.
- **Ejemplo de uso real:** Un técnico instala una pantalla nueva en una sucursal, dicta el código al gerente central, y la pantalla queda lista para recibir contenido.
- **Nivel de importancia:** Clave (Key)

### C. Flujo de uso (si aplica)
**¿Cómo empieza el usuario?**
El usuario conecta el dispositivo Raspberry Pi a la pantalla y a la red. El dispositivo muestra una pantalla de "Emparejamiento" con un código de 6 caracteres.

**¿Qué pasos sigue?**
1. En el Dashboard, navega a la sección **Dispositivos**.
2. Presiona el botón **"Emparejar Dispositivo"** (Pair Device).
3. Ingresa el código alfanumérico que se muestra en la pantalla física.
4. Confirma la acción.

**¿Qué ve en pantalla?**
- Dashboard: Modal de confirmación y aparición del nuevo dispositivo en la lista con estado "En línea".
- Pantalla física: El código desaparece y comienza a descargar/reproducir la playlist por defecto.

---

## Feature 3: Gestión de Biblioteca Multimedia
- **Nombre:** Subida y Gestión de Archivos (Imágenes/Video) y Sitios Web
- **Qué hace (1 frase):** Permite subir archivos visuales o agregar URLs externas para ser usadas en las pantallas.
- **Beneficio para el usuario:** Centraliza todos los activos digitales de la marca en un solo lugar, listos para ser distribuidos.
- **Ejemplo de uso real:** El diseñador sube el video de "Oferta de Verano.mp4" y el community manager agrega el enlace al dashboard de PowerBI de ventas.
- **Nivel de importancia:** Clave (Key)

### C. Flujo de uso (si aplica)
**¿Cómo empieza el usuario?**
El usuario accede a la sección **Multimedia** (Media Library) del dashboard.

**¿Qué pasos sigue?**
1. Presiona el botón **"Subir Archivo"** o **"Añadir Sitio Web"**.
2. **Para archivos:** Selecciona una o varias imágenes/videos desde su ordenador.
3. **Para webs:** Ingresa el nombre, la URL y configura la duración y orientación deseada.
4. Espera la confirmación de carga.

**¿Qué ve en pantalla?**
- Dashboard: Barra de progreso de subida (si aplica). Al finalizar, los nuevos elementos aparecen en la grilla/galería con miniaturas y detalles (resolución, duración).

---

## Feature 4: Creación y Edición de Playlists
- **Nombre:** Gestión de Playlists
- **Qué hace (1 frase):** Organiza secuencias ordenadas de contenido multimedia o web para su reproducción continua.
- **Beneficio para el usuario:** Permite crear narrativas visuales o segmentos de contenido temático (ej: "Mañana", "Tarde", "Promociones").
- **Ejemplo de uso real:** Se crea una playlist "Menu Almuerzo" con 5 imágenes de platos que rotan cada 10 segundos.
- **Nivel de importancia:** Clave (Key)

### C. Flujo de uso (si aplica)
**¿Cómo empieza el usuario?**
El usuario ingresa a la sección **Playlists** y selecciona "Nueva Playlist" o edita una existente.

**¿Qué pasos sigue?**
1. Asigna un nombre a la playlist y selecciona su tipo (Medios o Web).
2. Arrastra o selecciona ítems desde la biblioteca multimedia hacia la zona de la playlist.
3. Ajusta la duración de las imágenes (por defecto 10s) si es necesario.
4. Reordena los elementos arrastrándolos.
5. Guarda los cambios.

**¿Qué ve en pantalla?**
- Dashboard: Editor dividido con la biblioteca a un lado y la lista de reproducción al otro. Actualización inmediata de la lista al guardar.

---

## Feature 5: Programación de Horarios (Schedules)
- **Nombre:** Planificación Semanal (Scheduling)
- **Qué hace (1 frase):** Asigna playlists específicas a bloques horarios y días de la semana.
- **Beneficio para el usuario:** Automatiza el cambio de contenido según el contexto temporal (desayuno vs cena, días de semana vs fin de semana).
- **Ejemplo de uso real:** El restaurante programa automáticamente el menú de desayunos de 8:00 a 11:30 y el menú general de 11:30 a cierre.
- **Nivel de importancia:** Clave (Key)

### C. Flujo de uso (si aplica)
**¿Cómo empieza el usuario?**
El usuario entra a la sección **Horarios** (Schedules) y crea o edita un cronograma.

**¿Qué pasos sigue?**
1. Visualiza una grilla semanal (Lunes a Domingo).
2. Selecciona un bloque de tiempo en un día específico (ej: Lunes 09:00 - 12:00).
3. Asigna una Playlist a ese bloque.
4. Repite para otros bloques o usa la función "Copiar día" para replicar la configuración.
5. Guarda el cronograma.

**¿Qué ve en pantalla?**
- Dashboard: Calendario semanal visual con bloques de colores representando las playlists asignadas. Indicadores de solapamiento si hay errores.

---

## Feature 6: Asignación y Monitoreo de Dispositivos
- **Nombre:** Control de Dispositivos
- **Qué hace (1 frase):** Asigna el contenido (playlist por defecto o cronograma) a cada pantalla y monitorea su salud.
- **Beneficio para el usuario:** Control centralizado de qué se ve en cada pantalla y detección rápida de problemas (offline).
- **Ejemplo de uso real:** El administrador asigna el cronograma "Campaña Navidad" a todas las pantallas de la tienda "Centro" y verifica que todas estén en verde (online).
- **Nivel de importancia:** Secundaria (Operativa)

### C. Flujo de uso (si aplica)
**¿Cómo empieza el usuario?**
El usuario va a la lista de **Dispositivos** y selecciona uno para editar o ver detalles.

**¿Qué pasos sigue?**
1. Abre los detalles del dispositivo.
2. En "Configuración", selecciona la **Playlist por Defecto** y/o el **Cronograma** a utilizar.
3. Guarda la configuración.
4. Observa el estado "En línea" y la fecha de "Última conexión".

**¿Qué ve en pantalla?**
- Dashboard: Panel de propiedades del dispositivo. El estado se actualiza en tiempo real (verde/rojo).
- Pantalla física: En menos de un minuto, el contenido se actualiza automáticamente a la nueva configuración.
