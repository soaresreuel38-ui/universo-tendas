import { SiteHeader } from "./SiteChrome";
import { ui } from "./ui";

/** Abertura das páginas internas: título direto sobre fundo branco (a fotografia fica no conteúdo). */
export function PageIntro({
  eyebrow,
  title,
  text,
  children,
}: {
  eyebrow: string;
  title: string;
  text?: string;
  /** Mantidos por compatibilidade; a abertura não usa mais foto de fundo. */
  photoId?: string | null;
  photoAlt?: string;
  children?: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <section className="bg-white">
        <div className="mx-auto max-w-[1280px] px-5 pb-8 pt-12 sm:px-8 sm:pb-10 sm:pt-16">
          <p className={ui.meta}>{eyebrow}</p>
          <h1 className={`${ui.h1} mt-3 max-w-[20ch] [text-wrap:balance]`}>{title}</h1>
          {text ? <p className={`${ui.lead} mt-4 max-w-2xl`}>{text}</p> : null}
          {children}
        </div>
      </section>
    </>
  );
}
