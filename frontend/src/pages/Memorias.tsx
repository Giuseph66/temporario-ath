import { KnowledgeSection } from './Agente';

export function Memorias() {
    return (
        <div style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden' }}>
            <div style={{ flex: '1 1 0', overflowY: 'auto', padding: '40px 48px' }}>
                <div style={{ marginBottom: 30 }}>
                    <div style={{
                        fontFamily: "'Fraunces', serif", fontSize: 40, fontWeight: 400,
                        color: 'var(--ink-1)', letterSpacing: -1, lineHeight: 1, marginBottom: 8,
                    }}>
                        Memórias
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--ink-4)' }}>
                        Visualize o que o agente já tem indexado e suba novas fontes de conhecimento.
                    </div>
                </div>

                <KnowledgeSection />
            </div>
        </div>
    );
}
