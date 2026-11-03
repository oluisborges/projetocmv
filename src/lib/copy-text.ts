/**
 * Copia um texto para a área de transferência. Tenta a API moderna (só em página segura e com gesto da pessoa) e,
 * se ela não existir ou for recusada (celular, app instalado, navegador embutido), usa um campo escondido com `execCommand`.
 * Devolve `false` quando nada funcionou: a tela deve então mostrar o texto para a pessoa copiar na mão.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* cai para o método antigo */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    // 16px evita o zoom automático do iPhone; fora da tela para não piscar.
    area.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px";
    document.body.appendChild(area);
    area.focus();
    area.select();
    area.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
