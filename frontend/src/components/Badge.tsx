type BadgeColor = 'default' | 'green' | 'amber' | 'danger' | 'blue';

export function Badge({ children, color = 'default' }: { children: React.ReactNode; color?: BadgeColor }) {
    const colors: Record<BadgeColor, React.CSSProperties> = {
        default: { background: 'var(--paper-2)', color: 'var(--ink-3)', borderColor: 'var(--line-2)' },
        green:   { background: 'var(--accent-soft)', color: 'var(--accent-ink)', borderColor: '#c9d8d0' },
        amber:   { background: 'var(--amber-soft)', color: 'var(--amber)', borderColor: '#e0c090' },
        danger:  { background: 'var(--danger-soft)', color: 'var(--danger)', borderColor: '#e0a090' },
        blue:    { background: '#e0eaf8', color: '#1a4d8f', borderColor: '#aac0e0' },
    };
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 9px', borderRadius: 999, border: '1px solid',
            fontFamily: "'Geist Mono', monospace", fontSize: 11,
            fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5,
            ...colors[color],
        }}>
            {children}
        </span>
    );
}
