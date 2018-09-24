process.on('uncaughtException', error => console.error(`Uncaught exception: ${error.message}`, error));
process.on('unhandledRejection', error =>
  console.error(`Uncaught rejection "${error.constructor.name}": ${error.message}`, error)
);

if (process.env.NODE_ENV === 'development') {
  require('dotenv').config();
  process.env.NODE_DEBUG="@wireapp/*,wire-weather-bot/*"
}

import {Bot} from '@wireapp/bot-api';
import {OwmApiClient as WeatherAPI} from 'openweathermap-api-client';
import {MainHandler} from './MainHandler';

['WIRE_EMAIL', 'WIRE_PASSWORD', 'OPEN_WEATHER_API_KEY'].forEach(envVar => {
  if (!process.env[envVar]) {
    throw new Error(`Environment variable "${envVar}" is not set. Please define it or create a .env file.`);
  }
});

const bot = new Bot({
  email: process.env.WIRE_EMAIL!,
  password: process.env.WIRE_PASSWORD!,
});

const weatherAPI = new WeatherAPI({
  apiKey: process.env.OPEN_WEATHER_API_KEY!,
  lang: 'en',
  units: 'metric',
});

const mainHandler = new MainHandler({
  feedbackConversationId: process.env.WIRE_FEEDBACK_CONVERSATION_ID,
  weatherAPI,
});

bot.addHandler(mainHandler);
bot.start().catch(error => console.error(error));
