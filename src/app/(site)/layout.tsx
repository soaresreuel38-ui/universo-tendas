import { Reveal } from "@/components/site/Reveal";

/** Site público da Universo Tendas (mesmo backend e mesmo banco do painel /admin). */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh overflow-x-clip bg-white font-sans text-night [font-feature-settings:normal]">
      {children}
      <Reveal />
    </div>
  );
}
