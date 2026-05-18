import { useOutletContext } from 'react-router-dom';

export type AdminTheme = {
    bg: string;
    card: string;
    cardInner: string;
    border: string;
    borderSub: string;
    text: string;
    textMuted: string;
    textSub: string;
    accent: string;
    accentSoft: string;
    danger: string;
    success: string;
    inputBg: string;
};

const DARK: AdminTheme = {
    bg:         '#0a0908',
    card:       '#0f0e09',
    cardInner:  '#13110c',
    border:     '#2a2212',
    borderSub:  '#1a1508',
    text:       '#e8dfc8',
    textMuted:  '#c8b88a',
    textSub:    '#55524a',
    accent:     '#c8a96e',
    accentSoft: '#c8a96e18',
    danger:     '#c85a5a',
    success:    '#5fb878',
    inputBg:    '#13110c',
};

const LIGHT: AdminTheme = {
    bg:         '#faf8f2',
    card:       '#f0ebe0',
    cardInner:  '#e6dfc8',
    border:     '#d4b87a66',
    borderSub:  '#ddd4b8',
    text:       '#1a1510',
    textMuted:  '#4a3820',
    textSub:    '#8a7860',
    accent:     '#9a7520',
    accentSoft: '#c8a96e22',
    danger:     '#c85a5a',
    success:    '#2a7a4a',
    inputBg:    '#ede6d4',
};

export function useAdminTheme(): AdminTheme {
    const { darkMode } = useOutletContext<{ darkMode: boolean }>();
    return darkMode ? DARK : LIGHT;
}
