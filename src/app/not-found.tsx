import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-xl font-semibold">Página não encontrada</h1>
      <p className="text-sm text-faint">O registro pode ter sido removido ou o endereço está incorreto.</p>
      <Link href="/admin" className="rounded-lg bg-graphite px-4 py-2 text-sm font-medium text-white hover:bg-black">Voltar ao painel</Link>
    </main>
  );
}
