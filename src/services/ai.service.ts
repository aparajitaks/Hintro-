import Groq from 'groq-sdk';
import { z } from 'zod';
import { CitationValidator } from './citationValidator';
import { logger } from '../utils/logger';

// Zod schema for citation objects
export const citationSchema = z.object({
  timestamp: z.string().regex(/^(?:\d{1,2}:)?\d{2}:\d{2}$/, 'Timestamp format must be MM:SS or HH:MM:SS')
});

// Zod schemas for AI response items
export const summaryItemSchema = z.object({
  text: z.string().min(1, 'Text cannot be empty'),
  citations: z.array(citationSchema).min(1, 'At least one citation is required')
});

export const decisionItemSchema = z.object({
  text: z.string().min(1, 'Text cannot be empty'),
  citations: z.array(citationSchema).min(1, 'At least one citation is required')
});

export const followUpItemSchema = z.object({
  text: z.string().min(1, 'Text cannot be empty'),
  citations: z.array(citationSchema).min(1, 'At least one citation is required')
});

export const actionItemAIResponseSchema = z.object({
  task: z.string().min(1, 'Task description cannot be empty'),
  assignee: z.string().min(1, 'Assignee is required'),
  citations: z.array(citationSchema).min(1, 'At least one citation is required')
});

// Complete Zod schema representing the target shape of Groq output
export const analysisResponseSchema = z.object({
  summary: z.array(summaryItemSchema),
  decisions: z.array(decisionItemSchema),
  followUps: z.array(followUpItemSchema),
  actionItems: z.array(actionItemAIResponseSchema)
});

export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;

// Initialize the Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || 'mock-key-if-not-provided'
});

export class AIService {
  /**
   * Generates meeting insights from transcript segments using Groq API.
   * Employs prompt-level constraints and two-layer validation checks.
   */
  static async analyzeTranscript(
    meetingId: string,
    title: string,
    transcriptSegments: { timestamp: string; speaker: string; text: string }[]
  ): Promise<AnalysisResponse> {
    
    // LAYER 1: Prompt-level Grounding
    // Build an indexed list with speakers and timestamps
    const formattedTranscript = transcriptSegments
      .map((seg, idx) => `[${idx + 1}] ${seg.timestamp} ${seg.speaker}: ${seg.text}`)
      .join('\n');

    const systemPrompt = `You are a professional Meeting Intelligence AI designed to analyze transcripts and output raw JSON.
You are given a transcript as a numbered, indexed structure. Your goal is to extract:
1. Meeting Summary: Core discussion themes and updates.
2. Decisions: Concrete decisions made by the team.
3. Follow-up Suggestions: Actionable ideas or future discussions recommended.
4. Action Items: Immediate, clear tasks assigned to participants.

CRITICAL CITATION RULES:
- Every single entry in 'summary', 'decisions', 'followUps', and 'actionItems' MUST include a 'citations' array with at least one citation.
- A citation consists of the exact timestamp from the segment(s) you derived the point from, formatted as: {"timestamp": "MM:SS"} or {"timestamp": "HH:MM:SS"}.
- ONLY cite timestamps that are explicitly present in the transcript.
- If a point is derived from multiple transcript lines, include multiple citation objects, e.g., [{"timestamp": "00:10"}, {"timestamp": "00:20"}].

CRITICAL GROUNDING RULES (HALLUCINATION PREVENTION):
- Restrict all generated insights to the provided transcript.
- DO NOT invent attendees, assignees, action items, or decisions.
- DO NOT assume or extrapolate. If an assignee is mentioned for a task, use their name. If not explicitly assigned, use their speaker name if they agreed to do it.
- DO NOT invent timestamps. Fabricating timestamps will result in validation failure.

Your response MUST be a valid JSON object conforming exactly to this structure:
{
  "summary": [
    { "text": "Detailed summary text", "citations": [{ "timestamp": "00:10" }] }
  ],
  "decisions": [
    { "text": "Detailed decision text", "citations": [{ "timestamp": "00:20" }] }
  ],
  "followUps": [
    { "text": "Detailed follow-up suggestion", "citations": [{ "timestamp": "00:15" }] }
  ],
  "actionItems": [
    { "task": "Task description", "assignee": "Assignee name", "citations": [{ "timestamp": "00:20" }] }
  ]
}`;

    const userPrompt = `Meeting Title: ${title}
Transcript:
${formattedTranscript}`;

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      attempts++;
      logger.info(`Analyzing meeting transcript. Attempt ${attempts} of ${maxAttempts}`, { meetingId });

      try {
        const response = await groq.chat.completions.create({
          model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
          messages,
          temperature: 0.1, // High determinism to prevent hallucinations
          response_format: { type: 'json_object' }
        });

        const rawJsonText = response.choices[0]?.message?.content;
        if (!rawJsonText) {
          throw new Error('Groq API returned an empty completion content.');
        }

        // Attempt to parse JSON response
        let parsedData: any;
        try {
          parsedData = JSON.parse(rawJsonText);
        } catch (parseErr: any) {
          logger.warn('Failed to parse Groq response as JSON', { rawJsonText, attempt: attempts });
          messages.push({ role: 'assistant', content: rawJsonText });
          messages.push({
            role: 'user',
            content: 'Your output could not be parsed by JSON.parse. Make sure it is raw, valid JSON matching the schema and has no markdown formatting.'
          });
          continue;
        }

        // LAYER 2 - Part 1: Zod Schema Verification
        const schemaValidation = analysisResponseSchema.safeParse(parsedData);
        if (!schemaValidation.success) {
          const zodErrorMsg = schemaValidation.error.errors.map(e => `[${e.path.join('.')}]: ${e.message}`).join(', ');
          logger.warn('Groq response failed schema structure validation', { zodErrorMsg, attempt: attempts });

          messages.push({ role: 'assistant', content: rawJsonText });
          messages.push({
            role: 'user',
            content: `Your JSON structure failed schema validation. Errors: ${zodErrorMsg}. Please return the structure matching the exact shape expected.`
          });
          continue;
        }

        // LAYER 2 - Part 2: DB Timestamp Verification
        const validationResult = await CitationValidator.validate(meetingId, schemaValidation.data);
        if (!validationResult.isValid) {
          const invalidList = validationResult.invalidTimestamps.join(', ');
          logger.warn('Groq response failed citation timestamp validation', {
            invalidList,
            attempt: attempts
          });

          messages.push({ role: 'assistant', content: rawJsonText });
          
          let feedback = 'The citations in your JSON contained errors: ';
          if (validationResult.invalidTimestamps.length > 0) {
            feedback += `The following timestamps do not exist in the transcript: [${invalidList}]. You must only cite real timestamps.`;
          } else {
            feedback += 'Some items ended up with zero valid citations. Every item must have at least one valid citation.';
          }

          messages.push({
            role: 'user',
            content: feedback
          });
          continue;
        }

        // Both structure (Zod) and timestamps (DB) verified!
        return validationResult.cleanedData;

      } catch (err: any) {
        logger.error(`Groq Completion error on attempt ${attempts}`, { error: err.message });
        if (attempts === maxAttempts) {
          throw err;
        }
      }
    }

    throw new Error('Failed to generate meeting analysis with valid Zod structure and database-grounded citations.');
  }
}
