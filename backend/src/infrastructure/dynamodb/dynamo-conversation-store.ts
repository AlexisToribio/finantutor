import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

import type {
  ConversationEvent,
  ConversationRole,
  ConversationStore,
  NewConversationMessage,
  StoredConversationMessage,
} from "../../domain/ports/conversation-store.js";

const COUNTER_ID = 0;

type DynamoItem = {
  source: string;
  id: number;
  role: StoredConversationMessage["role"];
  event?: ConversationEvent;
  body: string;
  created_at: string;
  author: string;
  schema_version: number;
  status: StoredConversationMessage["status"];
  last_id?: number;
};

function eventOf(role: ConversationRole, event?: ConversationEvent): ConversationEvent {
  if (event) {
    return event;
  }
  return role === "teacher" ? "message_receive" : "message_replied";
}

function toStored(item: DynamoItem): StoredConversationMessage {
  return {
    id: item.id,
    role: item.role,
    event: eventOf(item.role, item.event),
    body: item.body,
    createdAt: item.created_at,
    author: item.author,
    schemaVersion: 1,
    status: item.status,
  };
}

export class DynamoConversationStore implements ConversationStore {
  constructor(
    private readonly doc: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  static fromEnv(tableName: string, region: string): DynamoConversationStore {
    const client = new DynamoDBClient({ region });
    const doc = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true },
    });
    return new DynamoConversationStore(doc, tableName);
  }

  async append(
    source: string,
    message: NewConversationMessage,
  ): Promise<StoredConversationMessage> {
    const next = await this.doc.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { source, id: COUNTER_ID },
        UpdateExpression: "ADD last_id :one",
        ExpressionAttributeValues: { ":one": 1 },
        ReturnValues: "UPDATED_NEW",
      }),
    );
    const id = Number(next.Attributes?.last_id);
    if (!Number.isInteger(id) || id < 1) {
      throw new Error("Failed to allocate conversation message id");
    }
    const stored: StoredConversationMessage = {
      ...message,
      id,
      createdAt: new Date().toISOString(),
      schemaVersion: 1,
    };
    const item: DynamoItem = {
      source,
      id,
      role: stored.role,
      event: stored.event,
      body: stored.body,
      created_at: stored.createdAt,
      author: stored.author,
      schema_version: stored.schemaVersion,
      status: stored.status,
    };
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
      }),
    );
    return stored;
  }

  async list(source: string): Promise<StoredConversationMessage[]> {
    const result = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "#source = :source AND #id > :zero",
        ExpressionAttributeNames: {
          "#source": "source",
          "#id": "id",
        },
        ExpressionAttributeValues: {
          ":source": source,
          ":zero": COUNTER_ID,
        },
        ScanIndexForward: true,
      }),
    );
    return (result.Items ?? []).map((item) => toStored(item as DynamoItem));
  }
}
