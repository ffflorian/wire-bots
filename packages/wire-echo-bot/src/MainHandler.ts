import * as logdown from 'logdown';

import {Connection, ConnectionStatus} from '@wireapp/api-client/dist/commonjs/connection';
import {MessageHandler} from '@wireapp/bot-api';
import {TextContent, LocationContent} from '@wireapp/core/dist/conversation/content/';
import {PayloadBundleIncoming, PayloadBundleType, ReactionType} from '@wireapp/core/dist/conversation/root';
import {CommandService, CommandType, ParsedCommand} from './CommandService';
import {formatUptime} from './utils';

const {version}: {version: string} = require('../package.json');

interface Config {
  feedbackConversationId?: string;
}

class MainHandler extends MessageHandler {
  private readonly logger: logdown.Logger;
  private readonly feedbackConversationId?: string;
  private readonly helpText = `**Hello!** 😎 This is Echo bot v${version} speaking.\n\nSend me anything and I will send it right back!\n\nFurther available commands:\n${CommandService.formatCommands()}\n\nMore information about this bot: https://github.com/ffflorian/wire-bots/tree/master/packages/wire-echo-bot.`;
  private readonly answerCache: {
    [conversationId: string]: {
      type: CommandType;
      waitingForContent: boolean;
    };
  };
  private readonly confirmTypes: PayloadBundleType[];

  constructor({feedbackConversationId}: Config) {
    super();
    this.feedbackConversationId = feedbackConversationId;
    this.answerCache = {};
    this.logger = logdown('wire-echo-bot/MainHandler', {
      logger: console,
      markdown: false,
    });
    this.confirmTypes = [
      PayloadBundleType.ASSET,
      PayloadBundleType.ASSET_IMAGE,
      PayloadBundleType.LOCATION,
      PayloadBundleType.PING,
      PayloadBundleType.TEXT,
    ];

    if (!this.feedbackConversationId) {
      this.logger.warn('You did not specify a feedback conversation ID and will not be able to receive feedback.');
    }
  }

  async handleEvent(payload: PayloadBundleIncoming) {
    if (this.confirmTypes.includes(payload.type)) {
      await this.sendConfirmation(payload.conversation, payload.id);
    }

    console.log({payload})

    switch (payload.type) {
      case PayloadBundleType.CONNECTION_REQUEST: {
        const connectRequest = payload.content as Connection;
        if (payload.conversation && connectRequest.status !== ConnectionStatus.CANCELLED) {
          return this.handleConnectionRequest(connectRequest.to, payload.conversation);
        }
      }
      case PayloadBundleType.TEXT: {
        if (payload.conversation) {
          const messageContent = payload.content as TextContent;
          return this.handleText(payload.conversation, messageContent.text, payload.id, payload.from);
        }
      }
      case PayloadBundleType.LOCATION: {
        if (payload.conversation) {
          const locationContent = payload.content as LocationContent;
          return this.sendLocation(payload.conversation, locationContent);
        }
      }
      case PayloadBundleType.PING: {
        if (payload.conversation) {
          return this.sendPing(payload.conversation);
        }
      }
      case PayloadBundleType.TYPING: {
        const {status} = payload.content as any;
        await this.sendTyping(payload.conversation, status);
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
            return this.answer(conversationId, {commandType: cachedCommandType, originalMessage: text, parsedArguments, rawCommand}, senderId);
          }
        }
        return this.answer(conversationId, {commandType, originalMessage: text, parsedArguments, rawCommand}, senderId);
      }
      default: {
        await this.sendReaction(conversationId, messageId, ReactionType.LIKE);
        if (this.answerCache[conversationId]) {
          delete this.answerCache[conversationId];
        }
        return this.answer(conversationId, {commandType, originalMessage: text, parsedArguments, rawCommand}, senderId);
      }
    }
  }

  async answer(conversationId: string, parsedCommand: ParsedCommand, senderId: string) {
    const {originalMessage, parsedArguments, commandType} = parsedCommand;

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
      default: {
        return this.sendText(conversationId, originalMessage);
      }
    }
  }

  async handleConnectionRequest(userId: string, conversationId: string): Promise<void> {
    await this.sendConnectionResponse(userId, true);
    await this.sendText(conversationId, this.helpText);
  }
}

export {MainHandler};
