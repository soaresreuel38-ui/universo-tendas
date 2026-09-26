"use client";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md rounded-lg border border-red-200 bg-white p-6 text-center">
      <h1 className="text-lg font-semibold">Algo deu errado</h1>
      <p className="mt-1 text-sm text-muted">A operação não foi concluída. Tente novamente; se continuar, avise o administrador.</p>
      <button onClick={reset} className="mt-4 rounded-lg bg-graphite px-4 py-2 text-sm font-medium text-white hover:bg-black">Tentar novamente</button>
    </div>
  );
}
