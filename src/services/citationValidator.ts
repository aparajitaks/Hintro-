import { prisma } from '../utils/db';
import { logger } from '../utils/logger';

export class CitationValidator {
  /**
   * Cross-checks citation timestamps against actual TranscriptSegment records in the DB.
   * 
   * @param meetingId ID of the meeting
   * @param data Parsed AI response containing summary, decisions, followUps, actionItems
   * @returns object with validation status, cleaned data, and a list of invalid timestamps
   */
  static async validate(
    meetingId: string,
    data: any
  ): Promise<{ isValid: boolean; cleanedData: any; invalidTimestamps: string[] }> {
    // 1. Fetch all valid timestamps for this meeting
    const segments = await prisma.transcriptSegment.findMany({
      where: { meetingId },
      select: { timestamp: true }
    });

    const validTimestamps = new Set(segments.map(s => s.timestamp));
    const invalidTimestamps: string[] = [];

    logger.info('Validating citations against DB segments', {
      meetingId,
      dbSegmentCount: validTimestamps.size,
      totalValidTimestamps: Array.from(validTimestamps)
    });

    // Helper to validate citations inside a list of items
    const validateList = (items: any[]): any[] => {
      if (!Array.isArray(items)) return [];

      return items.map((item) => {
        if (!item) return item;
        const rawCitations = Array.isArray(item.citations) ? item.citations : [];

        const validCitations = rawCitations.filter((cit: any) => {
          if (cit && typeof cit.timestamp === 'string') {
            const exists = validTimestamps.has(cit.timestamp);
            if (!exists) {
              invalidTimestamps.push(cit.timestamp);
            }
            return exists;
          }
          return false;
        });

        return {
          ...item,
          citations: validCitations
        };
      });
    };

    const cleanedData = {
      summary: validateList(data.summary),
      decisions: validateList(data.decisions),
      followUps: validateList(data.followUps),
      actionItems: validateList(data.actionItems)
    };

    // An item is invalid if its citations array is empty
    const hasEmptyCitations = (items: any[]) => {
      return items.some(item => !item.citations || item.citations.length === 0);
    };

    const hasEmptyCitationLists = 
      hasEmptyCitations(cleanedData.summary) ||
      hasEmptyCitations(cleanedData.decisions) ||
      hasEmptyCitations(cleanedData.followUps) ||
      hasEmptyCitations(cleanedData.actionItems);

    // Response is valid if there are no invalid timestamps and no items ended up with empty citations
    const isValid = invalidTimestamps.length === 0 && !hasEmptyCitationLists;

    if (!isValid) {
      logger.warn('AI analysis citation validation failed', {
        meetingId,
        invalidTimestamps,
        hasEmptyCitationLists
      });
    } else {
      logger.info('AI analysis citations successfully validated');
    }

    return {
      isValid,
      cleanedData,
      invalidTimestamps
    };
  }
}
