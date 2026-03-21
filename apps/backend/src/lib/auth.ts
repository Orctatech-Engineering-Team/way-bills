import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { sign, verify } from 'hono/jwt'
import { AppError, assert } from './errors'
import type { MiddlewareHandler } from 'hono'
import type { Context } from 'hono'
import { config } from '../config'

export const SESSION_COOKIE = 'wb_session'

export type SessionUser = {
  id: string
  name: string
  phone: string
  role: 'admin' | 'ops' | 'rider'
}

type SessionPayload = SessionUser & {
  exp: number
  iat: number
}

export async function createSessionToken(user: SessionUser) {
  const now = Math.floor(Date.now() / 1000)
  const payload: SessionPayload = {
    ...user,
    iat: now,
    exp: now + 60 * 60 * 12,
  }

  return sign(payload, config.jwtSecret, 'HS256')
}

export function setSessionCookie(c: Context, token: string) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: config.appEnv === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  })
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, SESSION_COOKIE, {
    path: '/',
  })
}

export async function readSessionUser(c: Context) {
  const token = getCookie(c, SESSION_COOKIE)
  if (!token) {
    return null
  }

  try {
    const payload = await verify(token, config.jwtSecret, 'HS256')
    return {
      id: String(payload.id),
      name: String(payload.name),
      phone: String(payload.phone),
      role: payload.role as SessionUser['role'],
    }
  } catch {
    return null
  }
}

export type AppVariables = {
  user: SessionUser
}

export const requireAuth: MiddlewareHandler<{ Variables: AppVariables }> = async (
  c,
  next,
) => {
  const user = await readSessionUser(c)
  assert(user, new AppError(401, 'unauthorized', 'Authentication required.'))
  c.set('user', user)
  await next()
}

export function requireRole(
  roles: SessionUser['role'][],
): MiddlewareHandler<{ Variables: AppVariables }> {
  return async (c, next) => {
    const user = c.get('user')
    assert(
      roles.includes(user.role),
      new AppError(403, 'forbidden', 'You do not have permission to do that.'),
    )
    await next()
  }
}
