# Artemis WhatsApp Bot

A modular, configurable WhatsApp implementation for Confluence Treinamento.

## Prerequisites

- Node.js (v18+ recommended)
- OpenAI API Key
- Meta (Facebook) Developer Account (for WhatsApp Business API)

## Installation

Since the environment setup had issues accessing `npm` directly, please run the following command in your terminal within this directory:

```bash
npm install
```

## Configuration

1. **Environment Variables**:
   Copy the content of `.env` (it's a template) and fill in your keys:
   - `WHATSAPP_API_TOKEN`: Your Meta Graph API token.
   - `WHATSAPP_PHONE_NUMBER_ID`: The ID of your WhatsApp phone number.
   - `OPENAI_API_KEY`: Your OpenAI API key.

2. **Bot Behavior**:
   Navigate to the `config/` directory to adjust:
   - `persona.json`: Change the tone, name, or strict principles.
   - `programs.json`: Add/Edit the courses offered.
   - `settings.json`: Toggle the "Kill Switch" or change support messages.

## Running the Bot

Development mode (hot-reload):
```bash
npm run dev
```

Production build:
```bash
npm run build
npm start
```

## Architecture

- **`src/services/ConfigLoader.ts`**: Loads JSON configurations.
- **`src/services/AIService.ts`**: Assembles the prompt using immutable principles + user context.
- **`src/services/BotService.ts`**: Orchestrates the flow (Kill Switch -> State -> AI -> WhatsApp).
- **`src/services/StateService.ts`**: In-memory user session management.
# temporario-ath
