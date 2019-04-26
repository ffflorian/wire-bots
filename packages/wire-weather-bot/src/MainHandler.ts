import * as logdown from 'logdown';
import {OwmApiClient as WeatherAPI} from 'openweathermap-api-client';

import {Connection, ConnectionStatus} from '@wireapp/api-client/dist/commonjs/connection';
import {MessageHandler} from '@wireapp/bot-api';
import {PayloadBundle, PayloadBundleType, ReactionType} from '@wireapp/core/dist/conversation/';
import {TextContent} from '@wireapp/core/dist/conversation/content/';
import {CommandService, CommandType, ParsedCommand} from './CommandService';
import {formatUptime} from './utils';
import {WeatherService} from './WeatherService';

const {version}: {version: string} = require('../package.json');

interface Config {
  feedbackConversationId?: string;
  weatherAPI: WeatherAPI;
}

class MainHandler extends MessageHandler {
  private readonly logger: logdown.Logger;
  private readonly feedbackConversationId?: string;
  private readonly weatherService: WeatherService;
  private readonly helpText = `**Hello!** 😎 This is weather bot v${version} speaking.

Available commands:
${CommandService.formatCommands()}

You can find more information about this bot [on GitHub](https://github.com/ffflorian/wire-bots/tree/master/packages/wire-weather-bot).`;
  private readonly answerCache: {
    [conversationId: string]: {
      type: CommandType;
      waitingForContent: boolean;
    };
  };

  constructor({feedbackConversationId, weatherAPI}: Config) {
    super();

    this.feedbackConversationId = feedbackConversationId;
    this.weatherService = new WeatherService(weatherAPI);
    this.answerCache = {};
    this.logger = logdown('wire-weather-bot/MainHandler', {
      logger: console,
      markdown: false,
    });

    if (!this.feedbackConversationId) {
      this.logger.warn('You did not specify a feedback conversation ID and will not be able to receive feedback.');
    }
  }

  async handleEvent(payload: PayloadBundle) {
    switch (payload.type) {
      case PayloadBundleType.TEXT: {
        if (payload.conversation) {
          const messageContent = payload.content as TextContent;
          return this.handleText(payload.conversation, messageContent.text, payload.id, payload.from);
        }
      }
      case PayloadBundleType.CONNECTION_REQUEST: {
        const connectRequest = payload.content as Connection;
        if (payload.conversation && connectRequest.status !== ConnectionStatus.CANCELLED) {
          return this.handleConnectionRequest(connectRequest.to, payload.conversation);
        }
      }
    }
  }

  async handleText(conversationId: string, text: string, messageId: string, senderId: string): Promise<void> {
    const {commandType, parsedArguments, rawCommand} = CommandService.parseCommand(text);

    switch (commandType) {
      case CommandType.NO_COMMAND:
      case CommandType.UNKNOWN_COMMAND: {
        if (this.answerCache[conversationId]) {
          const {type: cachedCommandType, waitingForContent} = this.answerCache[conversationId];
          if (waitingForContent) {
            await this.sendReaction(conversationId, messageId, ReactionType.LIKE);
            delete this.answerCache[conversationId];
            return this.answer(conversationId, {parsedArguments, commandType: cachedCommandType, rawCommand}, senderId);
          }
        }
        return this.answer(conversationId, {commandType, parsedArguments, rawCommand}, senderId);
      }
      default: {
        await this.sendReaction(conversationId, messageId, ReactionType.LIKE);
        if (this.answerCache[conversationId]) {
          delete this.answerCache[conversationId];
        }
        return this.answer(conversationId, {commandType, parsedArguments, rawCommand}, senderId);
      }
    }
  }

  async answer(conversationId: string, parsedCommand: ParsedCommand, senderId: string) {
    const {parsedArguments, rawCommand, commandType} = parsedCommand;
    switch (commandType) {
      case CommandType.HELP: {
        return this.sendText(conversationId, this.helpText);
      }
      case CommandType.UPTIME: {
        return this.sendText(conversationId, `Current uptime: ${formatUptime(process.uptime())}`);
      }
      case CommandType.WEATHER: {
        if (!parsedArguments) {
          this.answerCache[conversationId] = {
            type: commandType,
            waitingForContent: true,
          };
          return this.sendText(conversationId, 'For which city would you like to get the weather information?');
        }

        const weather = await this.weatherService.getWeather(parsedArguments);
        return this.sendText(conversationId, weather);
      }
      case CommandType.FORECAST: {
        if (!parsedArguments) {
          this.answerCache[conversationId] = {
            type: commandType,
            waitingForContent: true,
          };
          return this.sendText(conversationId, 'For which city would you like to get the weather forecast?');
        }

        const forecast = await this.weatherService.getForecast(parsedArguments);
        return this.sendText(conversationId, forecast);
      }
      case CommandType.FEEDBACK: {
        if (!this.feedbackConversationId) {
          return this.sendText(conversationId, `Sorry, the developer did not specify a feedback channel.`);
        }

        if (!parsedArguments) {
          this.answerCache[conversationId] = {
            type: commandType,
            waitingForContent: true,
          };
          return this.sendText(conversationId, 'What would you like to tell the developer?');
        }

        await this.sendText(this.feedbackConversationId, `Feedback from user "${senderId}":\n"${parsedArguments}"`);
        delete this.answerCache[conversationId];
        return this.sendText(conversationId, 'Thank you for your feedback.');
      }
      case CommandType.UNKNOWN_COMMAND: {
        return this.sendText(conversationId, `Sorry, I don't know the command "${rawCommand}" yet.`);
      }
      case CommandType.NO_COMMAND: {
        return;
      }
      default: {
        return this.sendText(conversationId, `Sorry, "${rawCommand}" is not implemented yet.`);
      }
    }
  }

  async handleConnectionRequest(userId: string, conversationId: string): Promise<void> {
    await this.sendConnectionResponse(userId, true);
    await this.sendText(conversationId, this.helpText);
  }
}

export {MainHandler};
