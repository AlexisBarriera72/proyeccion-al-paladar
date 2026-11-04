# Propuesta para Proyección al Paladar

_Borrador para revisar antes de enviar. Antes de enviarlo, completa las dos líneas "[por definir]"._

## Lo que harían sus clientes

- **Escoger la fecha.** Un calendario con sus funciones, en hora de Puerto Rico, y si quedan plazas.
- **Reservar en grupo.** Una sola reservación para todo el grupo, con nombre, contacto y condiciones.
- **Saber qué pasó.** La pantalla dice "Solicitud recibida" o "Reservación confirmada". Nunca dice que se pagó o se envió algo que no ocurrió.
- **Ver su reservación.** Un enlace privado para verla, añadirla al calendario o pedir un cambio.
- **Llegar con su número.** Al confirmarse, la pantalla muestra su número de reservación en grande para enseñarlo en la entrada.

## Lo que manejaría su equipo

- Crear funciones con fecha, capacidad, precio y política.
- Entrar a mano las solicitudes que llegan por Instagram. El sistema no lee ni envía mensajes de Instagram.
- Confirmar, mover o cancelar sin pasarse de la capacidad.
- La lista de la noche: buscar a cada cliente por su número, nombre o teléfono y marcar quién llegó.
- Quien llegue sin reservación: si quedan plazas, el equipo lo registra y le da su número en el momento.
- Casos especiales: si alguien pagó y ya no quedan plazas, el caso queda marcado para que el equipo lo resuelva.

## La demostración

- Es privada. Solo entran las personas invitadas, con su correo.
- Corre en una cuenta de Cloudflare que Alexis ya tiene. No es la cuenta del negocio.
- Usa fechas y clientes de prueba marcados DEMO. No acepta reservaciones reales, no cobra y no envía mensajes.
- Las fechas inspiradas en Shrek y Ratatouille solo reciben solicitudes. Tres "funciones de prueba" muestran cómo se confirma una reservación. Una es esa misma noche, para enseñar la entrada.
- Las fotos vienen de su Instagram y son de eventos anteriores. No se publicarán sin su permiso.
- Ustedes deciden cuándo borrar las reservaciones de prueba.

## Para lanzar necesitamos

1. La dirección del local y cómo llegar.
2. Fechas, duración, capacidad y tamaño máximo de grupo.
3. Precio por persona, qué incluye y si incluye IVU.
4. Su política de pago y cancelación, incluida la anunciada para el 15 de noviembre.
5. Qué hacer si alguien paga y ya no quedan plazas: otra fecha, reembolso o ambas.
6. Cómo confirman hoy una reservación y quién lo hace.
7. Los correos del equipo que usará el sistema.
8. Permiso para las fotos, y el logo en alta resolución.

## Etapas

1. **Demostración privada:** ahora, en la cuenta de Alexis.
2. **Lanzamiento con solicitudes:** en una cuenta de Cloudflare del negocio, con sus fechas reales. El equipo confirma cada solicitud.
3. **Confirmación en línea:** cuando aprueben lugar, capacidad, precio y política.

## Costos estimados

_Precios públicos al 8 de octubre de 2026._

- **Sitio y base de datos (Cloudflare):** US$0 al mes, en el plan gratuito.
- **Acceso del equipo (Cloudflare Access):** gratis hasta 50 usuarios.
- **Dirección del sitio:** una dirección gratuita de Cloudflare (`….workers.dev`).
- **Desarrollo y mantenimiento:** [por definir — Alexis].

## Lo que es de ustedes

- Al lanzar, el sitio real se instala en una cuenta de Cloudflare a nombre del negocio. Empieza vacía, sin datos de prueba.
- Los datos de sus clientes también quedan a nombre del negocio.
- Alexis tendría acceso de administrador mientras trabaje en el sitio. Ustedes pueden quitarlo cuando quieran.
- Su Instagram sigue siendo suyo. El sitio solo enlaza a él.
- El código: [por definir — por ejemplo, transferir el repositorio al lanzar].
