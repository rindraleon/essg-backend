export interface JwtPayload {
  email: string;
  sub: number;

  sid?: string;
  role?: string;
}
