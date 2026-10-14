# commentClassificator

Extensión de Chrome que clasifica los comentarios de YouTube con Jev (TypeSafe AI) para proteger la salud mental de quien crea contenido.

La especificación completa está en @docs/ESPECIFICACION.md. Léela antes de empezar cualquier tarea y síguela; si algo no encaja con ella, pregunta antes de desviarte.

## Idioma

- Habla conmigo en español.
- Código, nombres de variables y comentarios del código en inglés.
- Mensajes de commit, descripciones de pull request y documentación en español.

## Estructura

Monorepo con pnpm y TypeScript en todo:

- `packages/extension`: extensión de Chrome (WXT, Manifest V3, Preact en Shadow DOM).
- `packages/server`: servidor (Node con Hono o Fastify, PostgreSQL).
- `packages/shared`: categorías, tipos y contratos de la API entre extensión y servidor.

## Commits

Sigue Conventional Commits, con mensajes en español:

```
<tipo>(<ámbito>): <título en imperativo, máximo 72 caracteres>

Qué cambia y por qué.

Cómo se ha probado.
```

- Tipos: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.
- Ámbitos: `extension`, `server`, `shared`, o ninguno si afecta a todo.
- Un commit por cambio lógico. Cada commit compila y pasa las pruebas.
- Trabaja en una rama por funcionalidad y abre un pull request hacia `main`. No subas directamente a `main`.
- Nunca subas claves ni secretos. La clave de Jev y la de Stripe van en variables de entorno (`.env`, que está en `.gitignore`). Mantén un `.env.example` sin valores reales.

## Antes de cada commit

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
