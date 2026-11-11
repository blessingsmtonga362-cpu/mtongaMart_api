export interface AuthenticatedUser {
  sub: number;
  email: string;
  iat?: number;
  exp?: number;
}
