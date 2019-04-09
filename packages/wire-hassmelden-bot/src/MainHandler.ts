import logdown from 'logdown';

import {Connection, ConnectionStatus} from '@wireapp/api-client/dist/commonjs/connection';
import {MessageHandler} from '@wireapp/bot-api';
import {PayloadBundle, PayloadBundleType, ReactionType} from '@wireapp/core/dist/conversation/';
import {TextContent} from '@wireapp/core/dist/conversation/content/';
import {CommandService, CommandType, ParsedCommand} from './CommandService';
import {ReportService} from './ReportService';

interface Config {
  feedbackConversationId?: string;
}

class MainHandler extends MessageHandler {
  private readonly logger: logdown.Logger;
  private readonly reportService: ReportService;
  private readonly feedbackConversationId?: string;
  private readonly helpText = `Hallo!\n\nSchön, dass Du da bist!\n\nDu kannst über diesen Bot Links melden, von denen du denkst, dass sie strafrechtlich relevant sein könnten. Wir kümmern uns dann um den Rest!\n\nFür mehr Vernunft im Netz,\nmit ❤️, ✊ & 😉`;
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
    this.logger = logdown('wire-hassmelden-bot/MainHandler', {
      logger: console,
      markdown: false,
    });
    this.reportService = new ReportService();

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
    const {rawCommand, commandType} = parsedCommand;
    switch (commandType) {
      case CommandType.HELP: {
        return this.sendText(conversationId, this.helpText);
      }
      case CommandType.REPORT: {
        try {
          await this.reportService.report();
        } catch (error) {
          this.logger.error(error);
          return this.sendText(conversationId, 'Sorry, an error occured. Please try again later.');
        }

        await this.sendText(conversationId, 'Reported.');
        delete this.answerCache[conversationId];
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
