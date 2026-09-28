import {
  conversationSource,
  type ConversationStore,
  type StoredConversationMessage,
} from "../domain/ports/conversation-store.js";

export class ListConversationMessages {
  constructor(private readonly store: ConversationStore) {}

  async execute(userId: string, sessionId: string): Promise<StoredConversationMessage[]> {
    const cleanedUser = userId.trim();
    const cleanedSession = sessionId.trim();
    if (!cleanedUser) {
      throw new Error("user_id is required");
    }
    if (!cleanedSession) {
      throw new Error("session_id is required");
    }
    return this.store.list(conversationSource(cleanedUser, cleanedSession));
  }
}
