import {Absence, AbsenceIO} from 'absence.io';
import * as logdown from 'logdown';

interface AbsenceIOData {
  absenceIOApiKey: string;
  absenceIOApiKeyId: string;
}

class AbsenceService {
  private readonly absenceIO: AbsenceIO;
  private readonly logger: logdown.Logger;

  constructor(absenceIOData: AbsenceIOData) {
    this.absenceIO = new AbsenceIO({
      apiKey: absenceIOData.absenceIOApiKey,
      apiKeyId: absenceIOData.absenceIOApiKeyId,
    });
    this.logger = logdown('wire-absence-bot/AbsenceService', {
      logger: console,
      markdown: false,
    });
  }

  async getAllAbsences(): Promise<Absence[]> {
    const {data: absences} = await this.absenceIO.api.absence.retrieveAbsences();
    this.logger.info(`Got absences result:`, absences);

    return absences;
  }

  async getAbsentDays(): Promise<Array<{begin: Date; end: Date}>> {
    const absences = await this.getAllAbsences();
    return absences.map(absence => {
      return {
        begin: new Date(absence.start),
        end: new Date(absence.end),
      };
    });
  }
}

export {AbsenceService};
