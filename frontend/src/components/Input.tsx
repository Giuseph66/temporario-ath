export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input style={{
            width: '100%', padding: '9px 12px',
            border: '1px solid var(--line-2)', borderRadius: 8,
            background: 'var(--paper)', color: 'var(--ink-1)',
            fontSize: 14, fontFamily: 'inherit', outline: 'none',
        }} {...props} />
    );
}
