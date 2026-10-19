import { transcribe } from "ai";
import { defineTool } from "eve/tools";
import { z } from "zod";

// Any AI Gateway transcription model works here, e.g. "openai/whisper-1".
// It uses the same Gateway credentials as the agent's chat model.
const TRANSCRIPTION_MODEL = "openai/gpt-4o-mini-transcribe";

// eve stages every inbound file (Slack voice clips, web chat uploads) here and
// shows the model an `Attached file <path> (<mediaType>)` label. Audio bytes
// never reach the chat model, so this tool turns them into text.
const ATTACHMENTS_DIR = "/workspace/.eve/attachments/";

export default defineTool({
  description:
    "Transcribe an audio attachment, such as a voice note, to text. Pass the path from its `Attached file` label.",
  inputSchema: z.object({
    path: z.string().describe(`Attachment path under ${ATTACHMENTS_DIR}`),
  }),
  outputSchema: z.object({ transcript: z.string() }),
  async execute({ path }, ctx) {
    if (!path.startsWith(ATTACHMENTS_DIR)) {
      throw new Error(`Only attachments under ${ATTACHMENTS_DIR} can be transcribed.`);
    }

    const sandbox = await ctx.getSandbox();
    const audio = await sandbox.readBinaryFile({ path, abortSignal: ctx.abortSignal });
    if (!audio) {
      throw new Error(`Attachment not found: ${path}. Ask the user to send the voice note again.`);
    }

    try {
      const { text } = await transcribe({
        model: TRANSCRIPTION_MODEL,
        audio,
        abortSignal: ctx.abortSignal,
      });
      return { transcript: text.trim() };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Transcription failed (${reason}). Tell the user you couldn't understand the voice note and ask them to type it.`,
      );
    }
  },
});
