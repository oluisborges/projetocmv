import "server-only";
import { headers } from "next/headers";
import { LOGIN_WINDOW, clientIp, isOverLimit, loginKeys } from "@/lib/login-limit";
import { createAdminClient } from "@/lib/supabase/admin";

type Keys = { account: string; ip: string };

/** Sem a chave secreta (desenvolvimento local) o limite fica desligado em vez de travar o login. */
function admin() {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

export async function keysForRequest(email: string): Promise<Keys> {
  return loginKeys(clientIp(await headers()), email);
}

export async function isLoginThrottled(keys: Keys): Promise<boolean> {
  const db = admin();
  if (!db) return false;
  const [account, ip] = await Promise.all([
    db.rpc("login_failure_count", { p_key: keys.account, p_window: LOGIN_WINDOW }),
    db.rpc("login_failure_count", { p_key: keys.ip, p_window: LOGIN_WINDOW }),
  ]);
  // Se o banco falhar, não trava o login: a própria autenticação já depende do mesmo banco.
  if (account.error || ip.error) return false;
  return isOverLimit({ account: Number(account.data ?? 0), ip: Number(ip.data ?? 0) });
}

export async function recordLoginFailure(keys: Keys): Promise<void> {
  const db = admin();
  if (!db) return;
  await Promise.all([db.rpc("record_login_failure", { p_key: keys.account }), db.rpc("record_login_failure", { p_key: keys.ip })]);
}

/** Login certo zera só o contador da conta (o do IP continua valendo). */
export async function clearLoginFailures(keys: Keys): Promise<void> {
  const db = admin();
  if (!db) return;
  await db.rpc("clear_login_failures", { p_key: keys.account });
}
