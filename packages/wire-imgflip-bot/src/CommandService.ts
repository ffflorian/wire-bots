import * as logdown from 'logdown';

interface BasicCommand {
  command: string;
  description: string;
  type: CommandType;
}

interface CommandWithoutArguments extends BasicCommand {
  parseArguments: false;
}

interface CommandWithArguments extends BasicCommand {
  argumentNames: string[];
  parseArguments: true;
}

export interface ParsedCommand {
  commandType: CommandType;
  parsedArguments?: string[];
  rawCommand: string;
}

export enum CommandType {
  FEEDBACK,
  HELP,
  MEMES,
  NO_COMMAND,
  CAPTION,
  UNKNOWN_COMMAND,
  UPTIME,
}

const logger = logdown('wire-imgflip-bot/CommandService', {
  logger: console,
  markdown: false,
});

const basicCommands: Array<CommandWithArguments | CommandWithoutArguments> = [
  {
    command: 'help',
    description: 'Display this message.',
    parseArguments: false,
    type: CommandType.HELP,
  },
  {
    argumentNames: ['"id"', '"First text"', '"second text"'],
    command: 'caption',
    description: 'Caption a meme (arguments need to be set in quotes).',
    parseArguments: true,
    type: CommandType.CAPTION,
  },
  {
    argumentNames: ['count'],
    command: 'memes',
    description: 'Get a list of popular memes that may be captioned.',
    parseArguments: true,
    type: CommandType.MEMES,
  },
  {
    command: 'uptime',
    description: 'Get the current uptime of this bot.',
    parseArguments: false,
    type: CommandType.UPTIME,
  },
  {
    argumentNames: ['text'],
    command: 'feedback',
    description: 'Send feedback to the developer.',
    parseArguments: true,
    type: CommandType.FEEDBACK,
  },
];

export const CommandService = {
  formatCommands(): string {
    return basicCommands
      .sort((a, b) => a.command.localeCompare(b.command))
      .reduce((accumulator, command) => {
        const {command: commandName, description} = command;
        let answer = `${accumulator}\n- **/${commandName}`;
        if (command.parseArguments && command.argumentNames) {
          answer += command.argumentNames.map(argumentName => ` <${argumentName}>`).join(' ');
        }
        return `${answer}**: ${description}`;
      }, '');
  },
  parseCommand(rawMessage: string): ParsedCommand {
    const messageMatch = rawMessage.match(/^\/(\w+)( .*)?/);

    if (messageMatch && messageMatch.length) {
      const parsedCommand = messageMatch[1].toLowerCase();
      const parsedArguments = (messageMatch[2] || '').trim();

      for (const command of basicCommands) {
        if (command.command === parsedCommand) {
          logger.info(`Found command "${command.command}" for "/${parsedCommand}".`);
          return {
            commandType: command.type,
            parsedArguments: parsedQuotes ? parsedQuotes.map(quote => quote.replace(/"/g, '')) : parsedArguments.split(' '),
            rawCommand: parsedCommand,
          };
        }
      }
      logger.info(`Unknown command "${parsedCommand}".`);
      return {
        commandType: CommandType.UNKNOWN_COMMAND,
        rawCommand: parsedCommand,
      };
    }

    const unknownCommand = rawMessage.length > 10 ? `${rawMessage.substr(0, 10)}...` : rawMessage;

    logger.info(`No command found for "${unknownCommand}".`);
    return {
      commandType: CommandType.NO_COMMAND,
      parsedArguments: [rawMessage],
      rawCommand: rawMessage,
    };
  },
};
