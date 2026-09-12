import 'express';

declare global {
  namespace Express {
    interface Request {
      /** Populated by `requireAuth` middleware. */
      user?: {
        id: string;
        email: string;
      };
    }
  }
}

export {};
