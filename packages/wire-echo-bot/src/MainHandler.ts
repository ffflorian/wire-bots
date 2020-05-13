import * as logdown from 'logdown';

import {Connection, ConnectionStatus} from '@wireapp/api-client/dist/connection';
import {MessageHandler} from '@wireapp/bot-api';
import {PayloadBundle, PayloadBundleType, ReactionType} from '@wireapp/core/dist/conversation/';
import {AssetContent, LocationContent, TextContent} from '@wireapp/core/dist/conversation/content/';
import {QuotableMessage} from '@wireapp/core/dist/conversation/message/OtrMessage';
import {CommandService, CommandType, ParsedCommand} from './CommandService';
import {formatUptime} from './utils';

const {version}: {version: string} = require('../package.json');

interface Config {
  feedbackConversationId?: string;
}

export class MainHandler extends MessageHandler {
  private readonly answerCache: {
    [conversationId: string]: {
      type: CommandType;
      waitingForContent: boolean;
    };
  };
  private readonly confirmTypes: PayloadBundleType[];
  private readonly feedbackConversationId?: string;
  private readonly helpText = `**Hello!** 😎 This is Echo bot v${version} speaking.\n\nSend me anything and I will send it right back!\n\nFurther available commands:\n${CommandService.formatCommands()}\n\nMore information about this bot: https://github.com/ffflorian/wire-bots/tree/master/packages/wire-echo-bot.`;
  private readonly logger: logdown.Logger;

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

  async answerText(
    payload: QuotableMessage,
    conversationId: string,
    parsedCommand: ParsedCommand,
    senderId: string
  ): Promise<void> {
    const {originalMessage, parsedArguments, commandType} = parsedCommand;

    switch (commandType) {
      case CommandType.HELP: {
        return this.sendReply(conversationId, payload, this.helpText);
      }
      case CommandType.UPTIME: {
        return this.sendReply(conversationId, payload, `Current uptime: ${formatUptime(process.uptime())}`);
      }
      case CommandType.FEEDBACK: {
        if (!this.feedbackConversationId) {
          return this.sendReply(conversationId, payload, `Sorry, the developer did not specify a feedback channel.`);
        }

        if (!parsedArguments) {
          this.answerCache[conversationId] = {
            type: commandType,
            waitingForContent: true,
          };
          return this.sendReply(conversationId, payload, 'What would you like to tell the developer?');
        }

        this.logger.info(`Sending feedback from "${senderId}" to "${this.feedbackConversationId}".`);

        await this.sendText(this.feedbackConversationId, `Feedback from user "${senderId}":\n"${parsedArguments}"`);
        delete this.answerCache[conversationId];
        return this.sendReply(conversationId, payload, 'Thank you for your feedback.');
      }
      default: {
        return this.sendReply(conversationId, payload, originalMessage);
      }
    }
  }

  async handleConnectionRequest(userId: string, conversationId: string): Promise<void> {
    await this.sendConnectionResponse(userId, true);
    await this.sendText(conversationId, this.helpText);
  }

  async handleEvent(payload: PayloadBundle): Promise<void> {
    if (this.confirmTypes.includes(payload.type)) {
      await this.sendConfirmation(payload.conversation, payload.id);
    }

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
          return this.handleText(
            payload as QuotableMessage,
            payload.conversation,
            messageContent.text,
            payload.id,
            payload.from
          );
        }
      }
      case PayloadBundleType.ASSET_IMAGE: {
        if (payload.conversation) {
          const messageContent = payload.content as AssetContent;
          return this.handleImage(payload.conversation, messageContent);
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

  async handleImage(conversationId: string, messageContent: AssetContent): Promise<void> {
    const {original, uploaded} = messageContent;
    if (this.account && this.account.service && original && original.image && uploaded) {
      const imageBuffer = await this.account.service.conversation.getAsset(uploaded);

      await this.sendImage(conversationId, {
        data: imageBuffer,
        height: original.image.height,
        type: original.mimeType,
        width: original.image.width,
      });
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
            return this.answerText(
              payload,
              conversationId,
              {commandType: cachedCommandType, originalMessage: text, parsedArguments, rawCommand},
              senderId
            );
          }
        }
        return this.answerText(
          payload,
          conversationId,
          {commandType, originalMessage: text, parsedArguments, rawCommand},
          senderId
        );
      }
      default: {
        await this.sendReaction(conversationId, messageId, ReactionType.LIKE);
        if (this.answerCache[conversationId]) {
          delete this.answerCache[conversationId];
        }
        return this.answerText(
          payload,
          conversationId,
          {commandType, originalMessage: text, parsedArguments, rawCommand},
          senderId
        );
      }
    }
  }
}
