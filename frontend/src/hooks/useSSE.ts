import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useSSE(selectedId: string | null) {
    const qc = useQueryClient();

    useEffect(() => {
        const token = localStorage.getItem('accessToken');
        if (!token) return;

        const es = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);

        es.addEventListener('conversation-updated', (e: MessageEvent) => {
            const { leadId } = JSON.parse(e.data) as { leadId: string };
            qc.invalidateQueries({ queryKey: ['conversations'] });
            if (selectedId && leadId === selectedId) {
                qc.invalidateQueries({ queryKey: ['lead-detail', selectedId] });
            }
        });

        return () => es.close();
    }, [selectedId, qc]);
}
