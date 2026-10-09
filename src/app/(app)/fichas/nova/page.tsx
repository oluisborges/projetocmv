import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, TextField } from "@/components/forms";
import { Hint } from "@/components/hint";
import { requireMember } from "@/lib/auth";
import { createRecipe } from "../actions";

export const metadata = { title: "Nova ficha" };

export default async function NewRecipePage() {
  const { canWrite } = await requireMember();
  if (!canWrite) redirect("/fichas");

  return (
    <>
      <Link href="/fichas" className="text-sm font-semibold text-primary">
        ← Fichas
      </Link>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Nova ficha técnica</h1>
        <p className="text-muted">Primeiro o básico. Os ingredientes você adiciona na próxima tela.</p>
      </section>

      <ActionForm action={createRecipe} submitLabel="Criar e adicionar ingredientes">
        <TextField label="Nome da marmita" name="name" placeholder="Ex.: Frango grelhado com arroz e feijão" />
        <TextField label="Categoria (opcional)" name="category" required={false} placeholder="Ex.: Tradicional" />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Rende quantas porções"
            name="portions"
            inputMode="decimal"
            required={false}
            placeholder="Ex.: 25"
            hint={<Hint>Quantas marmitas saem dessa receita. Preencha este campo OU o peso de cada porção; o outro a gente calcula.</Hint>}
          />
          <TextField
            label="Peso da porção (g)"
            name="portion_weight"
            inputMode="decimal"
            required={false}
            placeholder="Ex.: 300"
            hint={<Hint>Quanto pesa cada marmita pronta. Se você preencher só este, as porções saem do peso total depois de cozinhar.</Hint>}
          />
        </div>
        <TextField
          label="Perda de cocção (%)"
          name="cooking_loss"
          inputMode="decimal"
          required={false}
          placeholder="Ex.: 25"
          hint={<Hint>Quanto a comida perde de peso ao cozinhar (água e gordura). Frango grelhado costuma perder uns 25%. Se não souber, deixe em branco.</Hint>}
        />
      </ActionForm>
    </>
  );
}
