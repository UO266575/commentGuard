// Shared Hono "Env" generic: the context variable requireSession sets and every
// authenticated route reads back.
export interface AppEnv {
  Variables: {
    userGoogleSub: string;
  };
}
