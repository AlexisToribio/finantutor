import type {
  ConversationStore,
  NewConversationMessage,
  StoredConversationMessage,
} from "../../domain/ports/conversation-store.js";

type Bucket = {
  lastId: number;
  messages: StoredConversationMessage[];
};

export class InMemoryConversationStore implements ConversationStore {
  private readonly buckets = new Map<string, Bucket>();

  async append(
    source: string,
    message: NewConversationMessage,
  ): Promise<StoredConversationMessage> {
    const bucket = this.buckets.get(source) ?? { lastId: 0, messages: [] };
    bucket.lastId += 1;
    const stored: StoredConversationMessage = {
      ...message,
      id: bucket.lastId,
      createdAt: new Date().toISOString(),
      schemaVersion: 1,
    };
    bucket.messages.push(stored);
    this.buckets.set(source, bucket);
    return stored;
  }

  async list(source: string): Promise<StoredConversationMessage[]> {
    return [...(this.buckets.get(source)?.messages ?? [])];
  }
}
