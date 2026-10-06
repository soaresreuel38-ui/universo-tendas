import { TentDrawing } from "@/components/brand/TentDrawing";
import { Photo } from "./Photo";
import { SiteHeader } from "./SiteChrome";
import { ui } from "./ui";

/** Abertura escura das páginas internas — a mesma linguagem da capa da página inicial. */
export function PageIntro({
  eyebrow,
  title,
  text,
  photoId,
  photoAlt,
  children,
}: {
  eyebrow: string;
  title: string;
  text?: string;
  photoId?: string | null;
  photoAlt?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-[#05101f] text-white">
      <SiteHeader overlay />
      {photoId ? (
        <div className="absolute inset-0 -z-10" aria-hidden>
          <Photo id={photoId} alt={photoAlt ?? ""} priority sizes="100vw" className="object-[50%_60%]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,10,22,0.88)_0%,rgba(3,10,22,0.7)_50%,rgba(3,10,22,0.45)_100%)]" />
        </div>
      ) : (
        <div className="absolute inset-0 -z-10" aria-hidden>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_80%,#12305a_0%,#05101f_65%)]" />
          <TentDrawing strokeWidth={0.6} className="absolute -bottom-[30%] -right-[12%] w-[90%] max-w-[900px] text-white/[0.09]" />
        </div>
      )}
      <div className="mx-auto max-w-[1360px] px-5 pb-14 pt-36 sm:px-10 sm:pb-20 sm:pt-44">
        <p className={`${ui.eyebrow} animate-rise text-white/60`}>{eyebrow}</p>
        <h1 className={`${ui.h1} mt-5 max-w-[16ch] animate-rise [animation-delay:60ms] [text-wrap:balance]`}>{title}</h1>
        {text ? <p className="mt-5 max-w-xl animate-rise text-[17px] leading-relaxed text-white/75 [animation-delay:120ms]">{text}</p> : null}
        {children}
      </div>
    </section>
  );
}
