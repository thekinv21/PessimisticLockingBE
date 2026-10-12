export type TJwtPayload = {
  sub: string;
  roles: string[];
  tokenVersion: number;
  iat?: number;
  exp?: number;
};
