// Staff identity: Cloudflare Access signs a JWT for every request it lets through; the Worker
// verifies it again (issuer, audience, signature) instead of trusting the edge alone. Roles come
// from D1. In local tests only, X-Test-Access-Email stands in for the token.
import {createRemoteJWKSet, jwtVerify} from 'jose';
import {testSwitches, type Env} from './env.ts';
import type {Role} from '../shared/types.ts';

let jwks: {domain: string; set: ReturnType<typeof createRemoteJWKSet>} | null = null;

function keySet(domain: string) {
  if (!jwks || jwks.domain !== domain) {
    jwks = {domain, set: createRemoteJWKSet(new URL(`${domain}/cdn-cgi/access/certs`))};
  }
  return jwks.set;
}

/** The verified Access email, or null. */
export async function accessEmail(request: Request, env: Env): Promise<string | null> {
  if (env.TEST_AUTH === '1' && testSwitches(env, request)) {
    const email = request.headers.get('x-test-access-email');
    return email ? email.trim().toLowerCase() : null;
  }
  const token = request.headers.get('cf-access-jwt-assertion');
  const domain = (env.ACCESS_TEAM_DOMAIN || '').replace(/\/+$/, '');
  const audiences = (env.ACCESS_AUDS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  if (!token || !domain || !audiences.length) return null;
  try {
    const {payload} = await jwtVerify(token, keySet(domain), {issuer: domain, audience: audiences});
    return typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
  } catch {
    return null;
  }
}

export interface StaffIdentity {
  email: string;
  role: Role;
}

export async function staffIdentity(request: Request, env: Env): Promise<StaffIdentity | null> {
  const email = await accessEmail(request, env);
  if (!email) return null;
  const row = await env
    .DB!.prepare('SELECT role FROM staff_members WHERE email = ? AND active = 1')
    .bind(email)
    .first<{role: Role}>();
  return row ? {email, role: row.role} : null;
}
