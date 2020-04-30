process.on('uncaughtException', error => console.error(`Uncaught exception: ${error.message}`, error));
process.on('unhandledRejection', (reason, promise) =>
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
);

if (process.env.NODE_ENV === 'development') {
  require('dotenv').config();
  process.env.NODE_DEBUG = '@wireapp/*,wire-imgflip-bot/*';
}

import {ClientType} from '@wireapp/api-client/dist/client';
import {Bot, BotConfig, BotCredentials} from '@wireapp/bot-api';
import {MainHandler} from './MainHandler';

['WIRE_EMAIL', 'WIRE_PASSWORD', 'IMGFLIP_USERNAME', 'IMGFLIP_PASSWORD'].forEach(envVar => {
  if (!process.env[envVar]) {
    throw new Error(`Environment variable "${envVar}" is not set. Please define it or create a .env file.`);
  }
});

const credentials: BotCredentials = {
  email: process.env.WIRE_EMAIL!,
  password: process.env.WIRE_PASSWORD!,
};

const config: BotConfig = {
  clientType: ClientType.TEMPORARY,
};

const bot = new Bot(credentials, config);

const mainHandler = new MainHandler({
  imgflipPassword: String(process.env.IMGFLIP_PASSWORD),
  imgflipUsername: String(process.env.IMGFLIP_USERNAME),
  feedbackConversationId: process.env.WIRE_FEEDBACK_CONVERSATION_ID,
});

bot.addHandler(mainHandler);
bot.start().catch(error => console.error(error));
