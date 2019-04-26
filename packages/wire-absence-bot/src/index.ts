process.on('uncaughtException', error => console.error(`Uncaught exception: ${error.message}`, error));
process.on('unhandledRejection', (reason, promise) =>
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
);

if (process.env.NODE_ENV === 'development') {
  require('dotenv').config();
  process.env.NODE_DEBUG = '@wireapp/*,wire-absence-bot/*';
}

import {ClientType} from '@wireapp/api-client/dist/commonjs/client';
import {Bot, BotConfig, BotCredentials} from '@wireapp/bot-api';
import {MainHandler} from './MainHandler';

['ABSENCEIO_KEY', 'ABSENCEIO_KEY_ID', 'WIRE_EMAIL', 'WIRE_PASSWORD'].forEach(envVar => {
  if (!process.env[envVar]) {
    throw new Error(`Environment variable "${envVar}" is not set. Please define it or create a .env file.`);
  }
});

const credentials: BotCredentials = {
  email: String(process.env.WIRE_EMAIL),
  password: String(process.env.WIRE_PASSWORD),
};

const config: BotConfig = {
  clientType: ClientType.TEMPORARY,
};

const bot = new Bot(credentials, config);

const mainHandler = new MainHandler({
  absenceIOApiKey: String(process.env.ABSENCEIO_KEY),
  absenceIOApiKeyId: String(process.env.ABSENCEIO_KEY_ID),
  feedbackConversationId: process.env.WIRE_FEEDBACK_CONVERSATION_ID,
});

bot.addHandler(mainHandler);
bot.start().catch(error => console.error(error));
