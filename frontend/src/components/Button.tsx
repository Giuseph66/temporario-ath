interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'default' | 'primary' | 'danger';
    children: React.ReactNode;
}

export function Button({ variant = 'default', children, style, ...props }: ButtonProps) {
    const base: React.CSSProperties = {
        padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
        fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex',
        alignItems: 'center', gap: 6,
    };
    const variants: Record<string, React.CSSProperties> = {
        default: { border: '1px solid var(--line-2)', background: 'var(--paper)', color: 'var(--ink-1)' },
        primary: { border: '1px solid var(--accent-ink)', background: 'var(--accent)', color: '#fff' },
        danger:  { border: '1px solid var(--danger)', background: 'var(--danger-soft)', color: 'var(--danger)' },
    };
    return <button style={{ ...base, ...variants[variant], ...style }} {...props}>{children}</button>;
}
