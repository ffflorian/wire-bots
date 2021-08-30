import * as logdown from 'logdown';

import {Connection, ConnectionStatus} from '@wireapp/api-client/src/connection';
import {MessageHandler} from '@wireapp/bot-api';
import {PayloadBundle, PayloadBundleType, ReactionType} from '@wireapp/core/src/main/conversation/';
import {TextContent} from '@wireapp/core/src/main/conversation/content/';
import {QuotableMessage} from '@wireapp/core/src/main/conversation/message/OtrMessage';
import {CommandService, CommandType, ParsedCommand} from './CommandService';
import {formatUptime} from './utils';
import {XKCDService} from './XKCDService';

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
  private readonly feedbackConversationId?: string;
  private readonly helpText = `**Hello!** 😎 This is XKCD bot v${version} speaking.\n\nAvailable commands:\n${CommandService.formatCommands()}\n\nMore information about this bot: https://github.com/ffflorian/wire-bots/tree/main/packages/wire-xkcd-bot.\n\nPlease also visit https://xkcd.com.`;
  private readonly logger: logdown.Logger;
  private readonly xkcdService: XKCDService;

  constructor({feedbackConversationId}: Config) {
    super();
    this.feedbackConversationId = feedbackConversationId;
    this.answerCache = {};
    this.logger = logdown('wire-xkcd-bot/MainHandler', {
      logger: console,
      markdown: false,
    });
    this.xkcdService = new XKCDService();

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
      case CommandType.RANDOM: {
        let comicResult;

        try {
          comicResult = await this.xkcdService.getRandomComic();
        } catch (error) {
          this.logger.error(error);
          return this.sendReply(conversationId, originalMessage, 'Sorry, an error occured. Please try again later.');
        }

        this.logger.info(`Sending random comic to "${senderId}".`);

        const {comment, index, title} = comicResult;

        await this.sendText(
          conversationId,
          `Here is your XKCD comic #${index} (https://xkcd.com/${index}) titled "${title}":`
        );
        await this.sendImage(conversationId, comicResult);
        delete this.answerCache[conversationId];
        return this.sendText(conversationId, `> ${comment}`);
      }
      case CommandType.COMIC: {
        if (!parsedArguments) {
          this.answerCache[conversationId] = {
            type: commandType,
            waitingForContent: true,
          };
          return this.sendReply(
            conversationId,
            originalMessage,
            'Which comic would you like to see? Answer with a number, "random" or "latest"'
          );
        }

        let comicResult;

        if (parsedArguments === 'latest') {
          try {
            comicResult = await this.xkcdService.getLatestComic();
          } catch (error) {
            this.logger.error(error);
            return this.sendReply(conversationId, originalMessage, 'Sorry, an error occured. Please try again later.');
          }
        } else if (parsedArguments === 'random') {
          try {
            comicResult = await this.xkcdService.getRandomComic();
          } catch (error) {
            this.logger.error(error);
            return this.sendReply(conversationId, originalMessage, 'Sorry, an error occured. Please try again later.');
          }
        } else if (!Number(parsedArguments) || Number(parsedArguments) < 1) {
          return this.sendReply(conversationId, originalMessage, 'Invalid number specified.');
        } else {
          try {
            comicResult = await this.xkcdService.getComic(Number(parsedArguments));
          } catch (error) {
            if ((error as Error).message.includes('404')) {
              return this.sendReply(
                conversationId,
                originalMessage,
                `Sorry, I could not find a comic by ID "${parsedArguments}".`
              );
            }
            this.logger.error(error);
            return this.sendReply(conversationId, originalMessage, 'Sorry, an error occured. Please try again later.');
          }
        }

        const {comment, index, title} = comicResult;

        this.logger.info(`Sending comic #${index} to "${senderId}".`);

        await this.sendText(
          conversationId,
          `Here is your XKCD comic #${index} (https://xkcd.com/${index}) titled "${title}":`
        );
        await this.sendImage(conversationId, comicResult);
        delete this.answerCache[conversationId];
        return this.sendText(conversationId, `> ${comment}`);
      }
      case CommandType.LATEST: {
        let comicResult;

        try {
          comicResult = await this.xkcdService.getLatestComic();
        } catch (error) {
          this.logger.error(error);
          return this.sendReply(conversationId, originalMessage, 'Sorry, an error occured. Please try again later.');
        }

        const {comment, index, title} = comicResult;

        await this.sendText(
          conversationId,
          `Here is your XKCD comic #${index} (https://xkcd.com/${index}) titled "${title}":`
        );
        await this.sendImage(conversationId, comicResult);
        return this.sendText(conversationId, `> ${comment}`);
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

        this.logger.info(`Sending feedback from "${senderId}" to "${this.feedbackConversationId}".`);

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
              {commandType: cachedCommandType, parsedArguments, rawCommand},
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
