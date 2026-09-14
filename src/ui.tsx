import { useEffect, useId, useState } from 'react';
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { CircleHelp, Info } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
export function usePersistentState<T>(key: string, initial: T, validator?: (value: unknown) => value is T) {
  const [value, setValue] = useState<T>(() => {
    try { const raw = localStorage.getItem(key); if (!raw) return initial; const parsed: unknown = JSON.parse(raw); return (validator ? validator(parsed) : typeof parsed === typeof initial) ? parsed as T : initial; } catch { return initial; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Private mode or storage quota: app remains usable in memory. */ } }, [key, value]);
  return [value, setValue] as const;
}
export function IconButton({ icon: Icon, children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; children?: ReactNode }) {
  return <button type="button" className={`${children ? 'btn' : 'icon-btn'} ${className}`} {...props}><Icon size={16} strokeWidth={1.7} aria-hidden="true" />{children}</button>;
}
export function SectionLabel({ icon: Icon, children, aside }: { icon: LucideIcon; children: ReactNode; aside?: ReactNode }) {
  return <div className="section-label"><span><Icon size={17} aria-hidden="true" />{children}</span>{aside}</div>;
}
export function TooltipNote({ children }: { children: ReactNode }) { return <div className="tooltip-note"><Info size={16} aria-hidden="true" /><div>{children}</div></div>; }

export function InfoTooltip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <span className="info-tooltip" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
    <button type="button" className="info-tooltip-trigger" aria-label={label} aria-describedby={open ? id : undefined} aria-expanded={open} onClick={() => setOpen(true)} onKeyDown={event => { if (event.key === 'Escape') setOpen(false); }}><CircleHelp size={14} aria-hidden="true" /></button>
    {open && <span id={id} className="info-tooltip-content" role="tooltip">{children}</span>}
  </span>;
}

export function HoverTooltip({ label, children, as: Element = 'span', className = '', style }: { label: ReactNode; children: ReactNode; as?: 'span' | 'div'; className?: string; style?: CSSProperties }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <Element className={`hover-tooltip ${className}`} style={style} tabIndex={0} aria-describedby={open ? id : undefined}
    onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
    {children}
    {open && <span id={id} className="hover-tooltip-content" role="tooltip">{label}</span>}
  </Element>;
}
