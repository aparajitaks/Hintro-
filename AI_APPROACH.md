# AI Grounding & Citation Strategy

This document details the design and strategy behind our AI-powered Meeting Intelligence Service. It ensures all AI outputs (summaries, decisions, follow-ups, and action items) are strictly grounded in the meeting transcript and are returned with verified citations.

---

## 1. Two-Layer Grounding System

Our system implements two layers of validation to prevent hallucination (inventing attendees, fabricating deadlines, making up timestamps):

### Layer 1: Prompt-level Grounding
1. **Indexed Transcript**: Before passing the transcript to Groq, the transcript is preprocessed and formatted as an indexed list containing segment indexes, timestamps, speaker names, and spoken text:
   ```text
   [1] 00:10 John: We should launch next Friday.
   [2] 00:20 Alice: I will prepare release notes.
   ```
2. **Explicit Negative Constraints**: The system prompt contains strict negative instructions:
   - Forbids inventing meeting details, action items, or attendees.
   - Forbids citing timestamps that do not exist in the transcript.
   - Enforces returning a JSON array structure with citations linked to each extracted item.
3. **Low Temperature**: The API request uses `temperature: 0.1` to maximize determinism and enforce close adherence to prompt instructions.

### Layer 2: Post-Generation Validation
Even with strict system prompts, LLMs can hallucinate timestamps or structure. We solve this with a double check:

#### Layer 2 Part 1: Schema Structure Check (Zod)
We check the shape of the raw JSON response using a Zod schema (`analysisResponseSchema`).
- If Groq's output has missing keys, wrong data types, or empty citation lists, the validator fails.
- Rather than throwing a runtime exception, the validation failure is caught and sent back to the model as an automated correction prompt (up to 3 retries).

#### Layer 2 Part 2: DB Citation Verification (`CitationValidator`)
Once the JSON schema is verified, we cross-check all citation timestamps against the database.
- We fetch all valid segment timestamps for the meeting from PostgreSQL.
- We iterate over every summary, decision, suggestion, and action item in the AI response.
- We check if the cited timestamp exists in the database.
- If a timestamp is invalid (hallucinated):
  - We push a correction message to the chat history: `The following timestamps do not exist in the transcript: [...]`.
  - We trigger a model retry.
  - If it fails after 3 attempts, we strip the invalid citation and log warnings to avoid losing the entire analysis.

---

## 2. Model Configuration & Parameters
- **API Provider**: Groq API
- **Model**: `llama-3.3-70b-versatile` (or `mixtral-8x7b-32768` as fallback)
- **Temperature**: `0.1` (ensures high citation accuracy and formatting structure compliance)
- **Response Format**: `{ type: "json_object" }` (guarantees returned content is parseable JSON)

---

## 3. Known Limitations
1. **Context Window Limitations**: Very long transcripts (e.g. 5+ hours) might exceed the context window limits of standard LLMs. For such cases, chunking or map-reduce aggregation would be required.
2. **Text-only Deadlines**: Action items created by the AI do not have precise calendar due dates because spoken transcripts refer to relative deadlines (e.g., "by next Friday"). The application handles this by defaulting due dates to 7 days after the meeting, while allowing manual overrides.
