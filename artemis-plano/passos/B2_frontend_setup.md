# Passo B2 — Frontend: Criar Projeto React + Vite + TypeScript

## Contexto
Artemis Bot em `/home/jesus/Neurelix/Artemis-Bot`. Criando o painel web em `packages/dashboard/`. Design language baseado nas telas de exemplo em `exemplo_telas/` — fontes Geist + Fraunces, paleta papel quente, accent verde `#1b6b4d`.

**Pré-requisito:** Passo B1 concluído (backend de auth funcionando).

## O que Fazer

**1. Crie a pasta e o projeto**
```bash
mkdir -p packages/dashboard
cd packages/dashboard
npm create vite@latest . -- --template react-ts
npm install
```

**2. Instale dependências do painel**
```bash
npm install react-router-dom axios @tanstack/react-query
npm install --save-dev @types/node
```

**3. Crie `src/design/tokens.css`**
Copie exatamente as CSS variables dos arquivos de exemplo (`exemplo_telas/v1-cockpit.jsx`):

```css
:root {
  --ink-1: #14130f;
  --ink-2: #2a2823;
  --ink-3: #55524a;
  --ink-4: #8a8579;
  --ink-5: #b8b3a6;
  --paper: #faf9f5;
  --paper-2: #f3f1ea;
  --paper-3: #e9e6db;
  --line: #e3dfd3;
  --line-2: #d4cfbf;
  --accent: #1b6b4d;
  --accent-soft: #e6f0eb;
  --accent-ink: #0d4a36;
  --amber: #a86a1a;
  --amber-soft: #f6ebd6;
  --danger: #a83a2a;
  --danger-soft: #f5e1dc;
  --radius-sm: 6px;
  --radius: 10px;
  --radius-lg: 14px;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Geist', -apple-system, system-ui, sans-serif;
  background: var(--paper-2);
  color: var(--ink-1);
}
```

**4. Adicione as fontes no `index.html`**
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500&display=swap" />
```

**5. Importe `tokens.css` em `src/main.tsx`**
```typescript
import './design/tokens.css';
```

**6. Configure proxy para o backend no `vite.config.ts`**
```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth': 'http://localhost:3000',
      '/api': 'http://localhost:3000',
    },
  },
});
```

## Verificação
```bash
npm run dev
```
Abre `http://localhost:5173`. Deve aparecer o template padrão do Vite com fonte Geist (confirme no DevTools → Elements → body: `font-family`).
