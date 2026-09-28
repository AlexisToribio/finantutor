export type ConversationRole = "teacher" | "agent";
export type ConversationEvent = "message_receive" | "message_replied";
export type ConversationStatus = "ok" | "error";

export type NewConversationMessage = {
  role: ConversationRole;
  event: ConversationEvent;
  body: string;
  author: string;
  status: ConversationStatus;
};

export type StoredConversationMessage = NewConversationMessage & {
  id: number;
  createdAt: string;
  schemaVersion: 1;
};

export type ConversationStore = {
  append(source: string, message: NewConversationMessage): Promise<StoredConversationMessage>;
  list(source: string): Promise<StoredConversationMessage[]>;
};

export function conversationSource(userId: string, sessionId: string): string {
  return `conversation/${userId}/${sessionId}`;
}
