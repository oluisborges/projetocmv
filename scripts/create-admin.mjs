// Cria um usuário admin Shogun. Uso:
//   node --env-file=.env.local scripts/create-admin.mjs <email> "<Nome>"
// A senha e a chave secreta do Supabase são digitadas/coladas no terminal (escondidas):
// nunca são gravadas em arquivo nem exibidas.
import { createClient } from "@supabase/supabase-js";
import readline from "node:readline";

const [email, fullName] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!email || !url) {
  console.error("Uso: node --env-file=.env.local scripts/create-admin.mjs <email> [nome]");
  process.exit(1);
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => (rl.stdoutMuted && s !== "\r\n" && s !== "\n" ? rl.output.write("*") : rl.output.write(s));
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
    rl.stdoutMuted = true;
  });
}

// A chave secreta pode vir do ambiente; se não vier, é colada aqui (escondida) e fica só na memória.
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  (await askHidden("Cole a chave secreta do Supabase (secret / service_role): ")).trim();
if (!key) {
  console.error("\nSem a chave secreta não dá para criar o usuário. Nada foi criado.");
  process.exit(1);
}

const password = await askHidden(`Senha para ${email} (mínimo 8 caracteres): `);
if (password.length < 8) {
  console.error("\nA senha precisa ter pelo menos 8 caracteres. Nada foi criado.");
  process.exit(1);
}
const confirm = await askHidden("Repita a senha: ");
if (confirm !== password) {
  console.error("\nAs senhas não são iguais. Nada foi criado.");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const { data, error } = await admin.auth.admin.createUser({
  email: email.trim().toLowerCase(),
  password,
  email_confirm: true,
  user_metadata: fullName ? { full_name: fullName } : {},
});
if (error || !data.user) {
  console.error(`\nNão foi possível criar o usuário: ${error?.message ?? "erro desconhecido"}`);
  process.exit(1);
}

// O gatilho do banco cria o perfil; aqui só marcamos como admin.
const { error: adminError } = await admin
  .from("profiles")
  .update({ is_platform_admin: true })
  .eq("id", data.user.id);
if (adminError) {
  console.error(`\nUsuário criado, mas não foi possível marcar como admin: ${adminError.message}`);
  process.exit(1);
}

console.log(`\nPronto: ${email} criado como admin Shogun. Entre em /login com e-mail e a senha que você acabou de digitar.`);
