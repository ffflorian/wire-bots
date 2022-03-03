import * as logdown from 'logdown';

import {Connection, ConnectionStatus} from '@wireapp/api-client/dist/commonjs/connection';
import {MessageHandler} from '@wireapp/bot-api';
import {PayloadBundleIncoming, PayloadBundleType, ReactionType} from '@wireapp/core/dist/conversation/';
import {TextContent} from '@wireapp/core/dist/conversation/content/';
import {CommandService, CommandType, ParsedCommand} from './CommandService';
import {FeedService} from './FeedService';
import {formatUptime} from './utils';

const {version}: {version: string} = require('../package.json');

interface Config {
  feedbackConversationId?: string;
}

class MainHandler extends MessageHandler {
  private readonly logger: logdown.Logger;
  private readonly feedService: FeedService;
  private readonly feedbackConversationId?: string;
  private readonly helpText = `**Hello!** 😎 This is RSS feed bot v${version} speaking.\n\nAvailable commands:\n${CommandService.formatCommands()}\n\nMore information about this bot: https://github.com/ffflorian/wire-bots/tree/master/packages/wire-feed-bot.`;
  private readonly answerCache: {
    [conversationId: string]: {
      type: CommandType;
      waitingForContent: boolean;
    };
  };

  constructor({feedbackConversationId}: Config) {
    super();
    this.feedbackConversationId = feedbackConversationId;
    this.answerCache = {};
    this.logger = logdown('wire-feed-bot/MainHandler', {
      logger: console,
      markdown: false,
    });
    this.feedService = new FeedService();

    if (!this.feedbackConversationId) {
      this.logger.warn('You did not specify a feedback conversation ID and will not be able to receive feedback.');
    }
  }

  async handleEvent(payload: PayloadBundleIncoming) {
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
            return this.answer(conversationId, {commandType: cachedCommandType, parsedArguments, rawCommand}, senderId);
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

        this.logger.info(`Sending feedback from "${senderId}" to "${this.feedbackConversationId}".`);

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
