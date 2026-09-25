import { Icon } from "@/components/ui/icons";

export function ProductThumb({ photoId, name, size = "sm" }: { photoId: string | null; name: string; size?: "sm" | "lg" }) {
  const cls = size === "lg" ? "h-28 w-28 md:h-36 md:w-36" : "h-10 w-10";
  if (!photoId) {
    return (
      <span className={`${cls} inline-flex shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-400`}>
        <Icon name="box" className={size === "lg" ? "h-10 w-10" : "h-5 w-5"} />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/api/fotos/${photoId}`} alt={`Foto de ${name}`} className={`${cls} shrink-0 rounded-md bg-zinc-100 object-cover`} loading="lazy" />;
}
