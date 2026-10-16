# Especificación: extensión clasificadora de comentarios

14 de octubre de 2026 · Ton. Versión editable: https://claude.ai/code/artifact/3aac554a-6a78-4272-88e6-996032171835

## Resumen

Una extensión de Chrome que, en cualquier vídeo de YouTube, sustituye la sección de comentarios por una elección: verlos tal cual o verlos clasificados en pestañas por categoría. El objetivo es que quien lee los comentarios, sobre todo quien crea contenido, decida cuándo exponerse a la toxicidad en vez de encontrársela de golpe.

- **Producto:** SaaS. La vista clasificada es la función de pago; la clasificación la hace Jev (TypeSafe AI) a través de un servidor propio.
- **Primera versión:** solo YouTube, solo la página del vídeo (no YouTube Studio), solo en Chrome de escritorio.
- **Usuarios:** cualquier persona con la extensión, en cualquier vídeo, sea suyo o no.

## Flujo de uso

Al llegar a los comentarios, el usuario elige entre verlos sin filtrar, que es YouTube tal cual, o filtrados, que es la función de pago.

1. El usuario abre un vídeo y baja a la zona de comentarios.
2. En lugar de la sección de comentarios aparecen dos botones: "Sin filtrar" y "Filtrados".
3. **Sin filtrar:** se muestra la sección normal de YouTube y la extensión deja de actuar por completo en ese vídeo.
4. **Filtrados:** la extensión carga hasta 300 comentarios en segundo plano, en bloques de unos 20.
5. El servidor clasifica cada comentario usando su caché o llamando a Jev.
6. Los comentarios aparecen en pestañas por categoría, que se van llenando a medida que llegan los resultados.
7. Opcionalmente, el usuario marca un comentario como mal clasificado: se mueve de pestaña y la corrección se guarda.

La elección se pregunta en cada vídeo. Sin sesión iniciada o sin cuota disponible, la opción de filtrados invita a iniciar sesión o suscribirse.

## Categorías y pestañas

Cada comentario principal recibe exactamente una de seis categorías fijas; si Jev no supera el 50 % de confianza, va a la pestaña "Sin clasificar". Las pestañas aparecen en este orden:

| # | Pestaña | Qué incluye |
| --- | --- | --- |
| 1 | Positivos | Admiración, agradecimiento o apoyo. |
| 2 | Dudas, sugerencias y crítica constructiva | Preguntas, propuestas de mejora y críticas con intención de ayudar, dirigidas de verdad a quien crea el vídeo. No incluye preguntas retóricas ni bromas, como "¿quién lo ve en 2026?". |
| 3 | Neutrales | Hablan del tema u otro asunto, cuentan una anécdota o hacen una broma, sin dar opinión sobre quien crea el contenido o el vídeo. |
| 4 | Spam o bots | Estafas, ofertas de dinero, enlaces, autopromoción o texto que parece automatizado. |
| 5 | Negativos | Tono negativo o despectivo sin llegar a ser tóxico. |
| 6 | Tóxicos | Insultos, acoso, discriminación y amenazas. |
| 7 | Sin clasificar | Confianza de Jev por debajo del 50 %. |

- No se pueden añadir ni editar categorías en esta versión.
- La pestaña Tóxicos muestra su recuento, pero al abrirla aparece un aviso de que no se recomienda leerlos. El resto de pestañas se abren sin aviso.
- El umbral del 50 % es un valor inicial; se ajustará con datos reales.
- **Mal clasificado:** cada comentario tiene una opción para indicar que está mal clasificado y elegir la categoría correcta. El comentario se mueve a esa pestaña y la corrección se guarda en el servidor para mejorar la clasificación.
- **Respuestas:** solo se clasifica el comentario principal. Sus respuestas se pueden desplegar debajo de él sin clasificar, porque un insulto en una respuesta suele ir dirigido a quien comentó, no a quien crea el vídeo.

## Obtención de comentarios

La extensión no usa la API oficial de YouTube: lee los comentarios que la propia web ya carga y pide más en segundo plano desde el navegador del usuario.

- La web de YouTube recibe los comentarios en bloques de unos 20, con una referencia para pedir el bloque siguiente. La extensión reutiliza esa misma llamada interna para ir pidiendo bloques sin que el usuario haga scroll.
- **Límite inicial:** los 300 comentarios principales más relevantes por vídeo, con un botón de "Cargar más". Muchos vídeos virales tienen miles de comentarios, y cada comentario clasificado consume cuota del plan.
- Las respuestas se piden solo cuando el usuario despliega un comentario, y no se clasifican.
- **Riesgo:** esa llamada interna no es pública. YouTube puede cambiarla sin aviso y la extensión dejaría de cargar comentarios hasta actualizarla. Conviene aislar esta parte en un módulo propio y tener una prueba que avise cuando deje de funcionar.

## Clasificación con Jev

La extensión envía los comentarios al servidor propio, y es el servidor el que llama a Jev; la clave de Jev nunca está en la extensión.

- **Qué es Jev:** un modelo de TypeSafe AI, en acceso anticipado desde el 15 de septiembre de 2026. No genera texto: recibe un estado y preguntas tipadas y devuelve respuestas estructuradas con probabilidades ([Wikipedia](<https://en.wikipedia.org/wiki/Jev_(AI_model)>)).
- **Llamada:** `POST https://api.typesafe.ai/v1/systemone` con una pregunta de tipo *choice* cuyas seis opciones son las categorías con su definición. El estado lleva el texto del comentario y el título del vídeo. La respuesta trae la categoría elegida, la probabilidad de cada una y una confianza de 0 a 1 ([documentación](https://docs.typesafe.ai/api)).
- **Versión fija:** usar una versión concreta (hoy `jev-1.13.0`) en vez de `jev-latest`, para que el umbral del 50 % no cambie de significado sin aviso.
- **Coste orientativo:** unos 0,042 USD por millón de tokens de entrada y salida gratuita, según el fabricante ([EkLine](https://ekline.io/blog/what-is-jev-ai)). Con unos 350 tokens por comentario, 1.000 comentarios cuestan alrededor de 1,5 céntimos.
- **Latencia:** entre 70 y 500 ms por llamada según el fabricante. Las pestañas se van llenando a medida que llegan los resultados.
- **Errores:** reintentos con espera creciente ante los códigos 429 y 529; si un comentario no se puede clasificar, va a Sin clasificar.
- **Idiomas:** cualquiera. TypeSafe no publica qué idiomas soporta, así que hay que validar la precisión en español e inglés con una muestra real antes de lanzar.

Ejemplo de petición y respuesta:

```json
{
  "model": "jev-1.13.0",
  "state": { "platform": "YouTube", "video_title": "…", "comment": "…" },
  "questions": {
    "category": {
      "type": "choice",
      "instructions": "Classify this YouTube comment, written to the video's creator, into the single best category.",
      "criteria": { "positivo": "…", "constructivo": "…", "neutral": "…", "spam": "…", "negativo": "…", "toxico": "…" }
    }
  }
}
```

```json
{
  "model": "jev-1.13.0",
  "answers": {
    "category": { "type": "choice", "choice": "negativo", "probabilities": { "negativo": 0.82, "…": 0.18 }, "confidence": 0.74 }
  },
  "usage": { "input_tokens": 318, "output_tokens": 34 }
}
```

## Servidor, cuentas y datos

El servidor hace tres cosas: identifica al usuario, controla su cuota y guarda una caché ligera de clasificaciones para no pagar dos veces el mismo comentario.

- **Cuentas:** inicio de sesión con Google. Sin sesión solo está disponible la vista sin filtrar.
- **Caché por comentario:** se guarda el ID del comentario, la categoría, la confianza, la versión del modelo y la fecha, sin el texto. Son unos 100 bytes por comentario, así que 10 millones de comentarios ocupan alrededor de 1 GB. Si mil personas abren el mismo vídeo, Jev solo se llama una vez por comentario.
- **Caducidad:** las entradas se borran a los 60 días, porque casi todos los comentarios se leen en las primeras semanas del vídeo.
- **Correcciones:** cuando alguien marca un comentario como mal clasificado, se guarda el ID del comentario, la categoría original, la propuesta y la versión del modelo. Para afinar las definiciones hará falta también el texto del comentario corregido; hay que decidir si se guarda.
- **Historial:** el usuario no tiene historial entre sesiones en esta versión.
- **Privacidad:** hace falta una política de privacidad que diga que el texto de los comentarios pasa por el servidor y por TypeSafe. Usar estos datos para estudios o venderlos queda como idea futura, y requeriría el consentimiento de los usuarios y revisar las condiciones de YouTube y la ley de protección de datos.

## Modelo de negocio y puntos abiertos

Es un SaaS con suscripción: la vista sin filtrar es gratis y la vista clasificada es de pago, con una cuota mensual de comentarios clasificados. Faltan por decidir estos puntos:

- [ ] Qué incluye el plan gratuito: nada de clasificación, o unos pocos vídeos al mes para probarla.
- [ ] Precio y tamaño de la cuota mensual de comentarios.
- [ ] Si un comentario que ya está en la caché descuenta cuota al usuario.
- [ ] Si se guarda el texto de los comentarios corregidos.
- [ ] Nombre del producto.
- [ ] Validar la precisión de Jev en español e inglés con una muestra real.

## Tecnologías

Todo el proyecto se hace en TypeScript, tanto la extensión como el servidor, para que ambos compartan las categorías y los formatos de las peticiones, y un cambio en un lado dé error al compilar en el otro.

| Pieza | Tecnología | Motivo |
| --- | --- | --- |
| Repositorio | Monorepo con pnpm: paquetes `extension`, `server` y `shared` | Tipos y categorías compartidos en un solo sitio. |
| Extensión | WXT (Vite, Manifest V3) | Recarga en caliente y empaquetado para Chrome. |
| Interfaz de pestañas | Preact dentro de un Shadow DOM | Ligero, y los estilos de YouTube no lo rompen. |
| Servidor | Node con Hono o Fastify | El servidor solo hace E/S: sesión, cuota, caché y llamada a Jev. |
| Base de datos | PostgreSQL | Usuarios, suscripciones, correcciones y caché con caducidad. Redis solo si hace falta más velocidad. |
| Login | Google con `chrome.identity`, token verificado en el servidor | Encaja con la cuenta de YouTube del usuario. |
| Pagos | Stripe | Suscripciones con cuota mensual. |
| Pruebas | Vitest y Playwright | Lógica unitaria y la extensión cargada en Chrome. |

Se descartan Java Spring y Go para el servidor porque no aportan rendimiento apreciable en un servicio tan pequeño y obligarían a duplicar los tipos. Python podría entrar más adelante si se entrena un clasificador propio con las correcciones guardadas.

## Repositorio y commits

El código vive en [UO266575/commentClassificator](https://github.com/UO266575/commentClassificator), y Claude Code sube el trabajo en commits pequeños y bien documentados.

- **Formato:** [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/). Tipos: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`. Ámbito según el paquete: `extension`, `server` o `shared`.
- **Idioma:** mensajes en español.
- **Título:** en imperativo y de 72 caracteres como máximo, por ejemplo `feat(extension): añadir botones de vista filtrada y sin filtrar`.
- **Cuerpo:** qué cambia y por qué, y cómo se ha probado.
- **Un commit por cambio lógico:** cada commit compila y pasa las pruebas.
- **Ramas:** cada funcionalidad en su rama y con su pull request hacia `main`; nunca se sube directamente a `main`.
- **Secretos:** la clave de Jev y la de Stripe van en variables de entorno, nunca en el repositorio.

## Fuera de alcance

Esta versión solo ayuda a leer; no modera ni guarda nada del usuario. Queda fuera:

- YouTube Studio y el panel de creador.
- Acciones sobre YouTube: borrar, ocultar usuarios o responder.
- Panel de estadísticas por vídeo.
- Categorías personalizadas.
- Clasificar las respuestas a los comentarios.
- Otras redes como TikTok o Instagram. Como se usan sobre todo en el móvil, la opción para una fase posterior sería una web donde el creador conecta su cuenta y lee sus comentarios ya clasificados.

## Fuentes

- [Jev (AI model), Wikipedia](<https://en.wikipedia.org/wiki/Jev_(AI_model)>)
- [Documentación de la API de TypeSafe](https://docs.typesafe.ai/api)
- [What Is Jev AI?, EkLine](https://ekline.io/blog/what-is-jev-ai)
- [Build a browser extension with Jev, Towards AI](https://pub.towardsai.net/build-a-browser-extension-with-jev-22e026255cb7)
