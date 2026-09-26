/** Esqueleto exibido enquanto a próxima tela carrega. */
export default function Loading() {
  return (
    <div className="animate-fade space-y-6" aria-busy="true" aria-label="Carregando">
      <div className="space-y-2">
        <div className="skeleton h-3 w-24" />
        <div className="skeleton h-8 w-72 max-w-full" />
      </div>
      <div className="skeleton h-24 w-full rounded-2xl" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="skeleton h-56 rounded-2xl" />
        <div className="skeleton h-56 rounded-2xl" />
        <div className="skeleton h-56 rounded-2xl" />
      </div>
    </div>
  );
}
