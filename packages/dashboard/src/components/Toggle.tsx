interface ToggleProps { on: boolean; onChange?: () => void; }

export function Toggle({ on, onChange }: ToggleProps) {
    return (
        <div onClick={onChange} style={{
            width: 38, height: 22, borderRadius: 999,
            background: on ? 'var(--accent)' : 'var(--ink-5)',
            position: 'relative', cursor: 'pointer', flexShrink: 0,
            transition: 'background .15s',
        }}>
            <div style={{
                position: 'absolute', top: 2, left: on ? 18 : 2,
                width: 18, height: 18, borderRadius: '50%', background: '#fff',
                boxShadow: '0 1px 2px rgba(0,0,0,.15)', transition: 'left .15s',
            }} />
        </div>
    );
}
