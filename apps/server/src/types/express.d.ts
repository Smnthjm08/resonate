export {};

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        isGuest: boolean;
        createdAt: Date;
        updatedAt: Date;
      };
    }
  }
}
