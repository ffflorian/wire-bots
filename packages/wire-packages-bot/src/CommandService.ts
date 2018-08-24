import * as logdown from 'logdown';

interface BasicCommand {
  argumentName?: string;
  command: string;
  description: string;
  parseArguments: boolean;
  type: CommandType;
}

export interface ParsedCommand {
  commandType: CommandType;
  parsedArguments?: string;
  rawCommand: string;
}

interface AnswerCommand {
  command: string;
  type: CommandType;
}

enum CommandType {
  ANSWER_NO,
  ANSWER_YES,
  BOWER,
  CRATES,
  FEEDBACK,
  HELP,
  NO_COMMAND,
  NPM,
  SERVICES,
  TYPES,
  UNKNOWN_COMMAND,
  UPTIME,
}

const logger = logdown('wire-packages-bot/CommandService', {
  logger: console,
  markdown: false,
});

const answerCommands: AnswerCommand[] = [
  {
    command: 'yes',
    type: CommandType.ANSWER_YES,
  },
  {
    command: 'no',
    type: CommandType.ANSWER_NO,
  },
];

const basicCommands: BasicCommand[] = [
  {
    command: 'help',
    description: 'Display this message.',
    parseArguments: false,
    type: CommandType.HELP,
  },
  {
    command: 'services',
    description: 'List the available services.',
    parseArguments: false,
    type: CommandType.SERVICES,
  },
  {
    command: 'uptime',
    description: 'Get the current uptime of this bot.',
    parseArguments: false,
    type: CommandType.UPTIME,
  },
  {
    argumentName: 'name',
    command: 'npm',
    description: 'Search for a package on npm.',
    parseArguments: true,
    type: CommandType.NPM,
  },
  {
    argumentName: 'name',
    command: 'bower',
    description: 'Search for a package on Bower.',
    parseArguments: true,
    type: CommandType.BOWER,
  },
  {
    argumentName: 'name',
    command: 'types',
    description: 'Search for type definitions on TypeSearch.',
    parseArguments: true,
    type: CommandType.TYPES,
  },
  {
    argumentName: 'name',
    command: 'crates',
    description: 'Search for a package on crates.io.',
    parseArguments: true,
    type: CommandType.CRATES,
  },
  {
    argumentName: 'text',
    command: 'feedback',
    description: 'Send feedback to the developer.',
    parseArguments: true,
    type: CommandType.FEEDBACK,
  },
];

const CommandService = {
  formatCommands(): string {
    return basicCommands.sort((a, b) => a.command.localeCompare(b.command)).reduce((prev, command) => {
      const {argumentName, command: commandName, description, parseArguments} = command;
      return (
        prev + `\n- **/${commandName}${parseArguments && argumentName ? ` <${argumentName}>` : ''}**: ${description}`
      );
    }, '');
  },
  parseCommand(message: string): ParsedCommand {
    const messageMatch = message.match(/\/(\w+)(?: (.*))?/);

    for (const answerCommand of answerCommands) {
      if (message.toLowerCase() === answerCommand.command) {
        return {
          commandType: answerCommand.type,
          rawCommand: message.toLowerCase(),
        };
      }
    }

    if (messageMatch && messageMatch.length) {
      const parsedCommand = messageMatch[1].toLowerCase();
      const parsedArguments = messageMatch[2];

      for (const command of basicCommands) {
        if (command.command === parsedCommand) {
          logger.info(`Found command "${command.command}" for "/${parsedCommand}".`);
          return {
            commandType: command.type,
            parsedArguments: command.parseArguments ? parsedArguments : '',
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
    logger.info(`No command found for "${message.length > 10 ? message.substr(0, 10) + '...' : message}".`);
    return {
      parsedArguments: message,
      rawCommand: message,
      commandType: CommandType.NO_COMMAND,
    };
  },
};

export {CommandService, CommandType};
