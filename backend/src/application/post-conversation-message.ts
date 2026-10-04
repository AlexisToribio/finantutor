import type { AgentRuntime } from '../domain/ports/agent-runtime.js';
import type { AgentEvent } from '../domain/ports/agent-events.js';
import { conversationSource, type ConversationStore } from '../domain/ports/conversation-store.js';
import { userAuthor } from '../domain/ports/token-verifier.js';

export const AGENT_UNAVAILABLE = 'El tutor no respondió. Inténtalo de nuevo.';

export class PostConversationMessage {
	constructor(
		private readonly runtime: AgentRuntime,
		private readonly store: ConversationStore,
	) {}

	async *execute(userId: string, sessionId: string, prompt: string): AsyncGenerator<AgentEvent> {
		const cleanedUser = userId.trim();
		const cleanedSession = sessionId.trim();
		const cleanedPrompt = prompt.trim();
		if (!cleanedUser) {
			throw new Error('user_id is required');
		}
		if (!cleanedSession) {
			throw new Error('session_id is required');
		}
		if (!cleanedPrompt) {
			throw new Error('prompt is required');
		}
		const source = conversationSource(cleanedUser, cleanedSession);
		const author = userAuthor(cleanedUser);

		await this.store.append(source, {
			role: 'teacher',
			event: 'message_receive',
			body: cleanedPrompt,
			author,
			status: 'ok',
		});

		let done: Record<string, unknown> | undefined;
		let replyStatus: 'ok' | 'error' = 'ok';
		for await (const event of this.runtime.stream(cleanedSession, cleanedPrompt, author)) {
			if (event.type === 'done') {
				const reply = typeof event.reply === 'string' ? event.reply : '';
				if (!reply.trim()) {
					done = { ...event, reply: AGENT_UNAVAILABLE };
					replyStatus = 'error';
					yield done as AgentEvent;
					continue;
				}
				done = event;
			}
			yield event;
		}
		if (!done) {
			return;
		}
		const reply = typeof done.reply === 'string' ? done.reply : AGENT_UNAVAILABLE;
		await this.store.append(source, {
			role: 'agent',
			event: 'message_replied',
			body: reply,
			author,
			status: replyStatus,
		});
	}
}
