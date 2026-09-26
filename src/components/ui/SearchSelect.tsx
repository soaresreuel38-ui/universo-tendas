"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Icon } from "./icons";

export type SearchOption = { value: string; label: string; sub?: string; right?: string; disabled?: boolean };

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * Campo de seleção com busca por texto (nome, código, telefone…). Funciona bem no celular:
 * digite parte do nome e toque no resultado.
 */
export function SearchSelect({
  options,
  name,
  value: controlled,
  defaultValue = "",
  onChange,
  placeholder = "Buscar…",
  required,
  emptyText = "Nada encontrado.",
}: {
  options: SearchOption[];
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  emptyText?: string;
}) {
  const [internal, setInternal] = useState(defaultValue);
  const value = controlled ?? internal;
  const selected = options.find((o) => o.value === value);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = norm(query.trim());
    const list = q ? options.filter((o) => norm(`${o.label} ${o.sub ?? ""}`).includes(q)) : options;
    return list.slice(0, 60);
  }, [options, query]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function choose(o: SearchOption) {
    if (o.disabled) return;
    if (controlled === undefined) setInternal(o.value);
    onChange?.(o.value);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={boxRef} className="relative mt-1">
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <div className="relative">
        <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          required={required && !value}
          value={open ? query : (selected?.label ?? "")}
          placeholder={selected ? selected.label : placeholder}
          onFocus={() => {
            setOpen(true);
            setActive(0);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && open) {
              e.preventDefault();
              if (filtered[active]) choose(filtered[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          className="block w-full rounded-lg border border-line-strong bg-white py-2 pl-9 pr-3 text-graphite outline-none placeholder:text-faint focus:border-ink focus:ring-4 focus:ring-ink/10"
        />
      </div>
      {selected && !open && selected.sub ? <p className="mt-1 text-xs text-faint">{selected.sub}</p> : null}
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-40 mt-1 max-h-72 w-full overflow-auto rounded-md border border-line bg-white py-1 shadow-lg"
        >
          {filtered.length === 0 ? <li className="px-3 py-2 text-sm text-faint">{emptyText}</li> : null}
          {filtered.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              aria-disabled={o.disabled}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(o);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm ${
                o.disabled ? "cursor-not-allowed opacity-50" : i === active ? "bg-canvas" : ""
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-graphite">{o.label}</span>
                {o.sub ? <span className="block truncate text-xs text-faint">{o.sub}</span> : null}
              </span>
              {o.right ? <span className="shrink-0 text-xs text-faint">{o.right}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
