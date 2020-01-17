import * as logdown from 'logdown';
import {OwmApiClient as WeatherAPI} from 'openweathermap-api-client';

import {Connection, ConnectionStatus} from '@wireapp/api-client/dist/connection';
import {MessageHandler} from '@wireapp/bot-api';
import {PayloadBundle, PayloadBundleType, ReactionType} from '@wireapp/core/dist/conversation/';
import {TextContent} from '@wireapp/core/dist/conversation/content/';
import {QuotableMessage} from '@wireapp/core/dist/conversation/message/OtrMessage';
import {CommandService, CommandType, ParsedCommand} from './CommandService';
import {formatUptime} from './utils';
import {WeatherService} from './WeatherService';

const {version}: {version: string} = require('../package.json');

interface Config {
  feedbackConversationId?: string;
  weatherAPI: WeatherAPI;
}

export class MainHandler extends MessageHandler {
  private readonly answerCache: {
    [conversationId: string]: {
      type: CommandType;
      waitingForContent: boolean;
    };
  };
  private readonly feedbackConversationId?: string;
  private readonly helpText = `**Hello!** 😎 This is weather bot v${version} speaking.\n\nAvailable commands:\n${CommandService.formatCommands()}\n\nMore information about this bot: https://github.com/ffflorian/wire-bots/tree/master/packages/wire-weather-bot`;
  private readonly logger: logdown.Logger;
  private readonly weatherService: WeatherService;

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

  async answer(
    originalMessage: QuotableMessage,
    conversationId: string,
    parsedCommand: ParsedCommand,
    senderId: string
  ): Promise<void> {
    const {parsedArguments, rawCommand, commandType} = parsedCommand;
    switch (commandType) {
      case CommandType.HELP: {
        return this.sendReply(conversationId, originalMessage, this.helpText);
      }
      case CommandType.UPTIME: {
        return this.sendReply(conversationId, originalMessage, `Current uptime: ${formatUptime(process.uptime())}`);
      }
      case CommandType.WEATHER: {
        if (!parsedArguments) {
          this.answerCache[conversationId] = {
            type: commandType,
            waitingForContent: true,
          };
          return this.sendReply(
            conversationId,
            originalMessage,
            'For which city would you like to get the weather information?'
          );
        }

        const weather = await this.weatherService.getWeather(parsedArguments);
        return this.sendReply(conversationId, originalMessage, weather);
      }
      case CommandType.FORECAST: {
        if (!parsedArguments) {
          this.answerCache[conversationId] = {
            type: commandType,
            waitingForContent: true,
          };
          return this.sendReply(
            conversationId,
            originalMessage,
            'For which city would you like to get the weather forecast?'
          );
        }

        const forecast = await this.weatherService.getForecast(parsedArguments);
        return this.sendReply(conversationId, originalMessage, forecast);
      }
      case CommandType.FEEDBACK: {
        if (!this.feedbackConversationId) {
          return this.sendReply(
            conversationId,
            originalMessage,
            `Sorry, the developer did not specify a feedback channel.`
          );
        }

        if (!parsedArguments) {
          this.answerCache[conversationId] = {
            type: commandType,
            waitingForContent: true,
          };
          return this.sendReply(conversationId, originalMessage, 'What would you like to tell the developer?');
        }

        await this.sendText(this.feedbackConversationId, `Feedback from user "${senderId}":\n"${parsedArguments}"`);
        delete this.answerCache[conversationId];
        return this.sendReply(conversationId, originalMessage, 'Thank you for your feedback.');
      }
      case CommandType.UNKNOWN_COMMAND: {
        return this.sendReply(conversationId, originalMessage, `Sorry, I don't know the command "${rawCommand}" yet.`);
      }
      case CommandType.NO_COMMAND: {
        return;
      }
      default: {
        return this.sendReply(conversationId, originalMessage, `Sorry, "${rawCommand}" is not implemented yet.`);
      }
    }
  }

  async handleConnectionRequest(userId: string, conversationId: string): Promise<void> {
    await this.sendConnectionResponse(userId, true);
    await this.sendText(conversationId, this.helpText);
  }

  async handleEvent(payload: PayloadBundle): Promise<void> {
    switch (payload.type) {
      case PayloadBundleType.TEXT: {
        if (payload.conversation) {
          const messageContent = payload.content as TextContent;
          return this.handleText(
            payload as QuotableMessage,
            payload.conversation,
            messageContent.text,
            payload.id,
            payload.from
          );
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

  async handleText(
    payload: QuotableMessage,
    conversationId: string,
    text: string,
    messageId: string,
    senderId: string
  ): Promise<void> {
    const {commandType, parsedArguments, rawCommand} = CommandService.parseCommand(text);

    switch (commandType) {
      case CommandType.NO_COMMAND:
      case CommandType.UNKNOWN_COMMAND: {
        if (this.answerCache[conversationId]) {
          const {type: cachedCommandType, waitingForContent} = this.answerCache[conversationId];
          if (waitingForContent) {
            await this.sendReaction(conversationId, messageId, ReactionType.LIKE);
            delete this.answerCache[conversationId];
            return this.answer(
              payload,
              conversationId,
              {parsedArguments, commandType: cachedCommandType, rawCommand},
              senderId
            );
          }
        }
        return this.answer(payload, conversationId, {commandType, parsedArguments, rawCommand}, senderId);
      }
      default: {
        await this.sendReaction(conversationId, messageId, ReactionType.LIKE);
        if (this.answerCache[conversationId]) {
          delete this.answerCache[conversationId];
        }
        return this.answer(payload, conversationId, {commandType, parsedArguments, rawCommand}, senderId);
      }
    }
  }
}
