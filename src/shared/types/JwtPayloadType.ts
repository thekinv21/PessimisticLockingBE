/**
 * Claims signed into access and refresh tokens (besides `exp`). Roles and
 * profile data are read from the database on every request instead.
 */

export type TJwtPayload = {
  sub: string;
  tokenVersion: number;
};
