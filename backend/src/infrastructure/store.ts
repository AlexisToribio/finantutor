import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  paginateQuery,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import type { Store } from "../domain/contracts.js";

export class SqliteStore implements Store {
  readonly database: DatabaseSync;
  constructor(filename: string) {
    if (filename !== ":memory:")
      mkdirSync(dirname(filename), { recursive: true });
    this.database = new DatabaseSync(filename);
    this.database.exec(
      "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS records(pk TEXT, sk TEXT, payload TEXT NOT NULL, PRIMARY KEY(pk,sk)); CREATE TABLE IF NOT EXISTS locks(id TEXT PRIMARY KEY, token TEXT, expires INTEGER);",
    );
  }
  async commit(
    writes: Array<{ pk: string; sk: string; value: object }>,
  ): Promise<void> {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const statement = this.database.prepare(
        "INSERT INTO records VALUES(?,?,?) ON CONFLICT(pk,sk) DO UPDATE SET payload=excluded.payload",
      );
      for (const { pk, sk, value } of writes)
        statement.run(pk, sk, JSON.stringify(value));
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
  async get<T>(pk: string, sk: string): Promise<T | undefined> {
    const row = this.database
      .prepare("SELECT payload FROM records WHERE pk=? AND sk=?")
      .get(pk, sk);
    return row ? (JSON.parse(row.payload as string) as T) : undefined;
  }
  async put(pk: string, sk: string, value: object): Promise<void> {
    this.database
      .prepare(
        "INSERT INTO records VALUES(?,?,?) ON CONFLICT(pk,sk) DO UPDATE SET payload=excluded.payload",
      )
      .run(pk, sk, JSON.stringify(value));
  }
  async list<T>(pk: string, prefix: string): Promise<T[]> {
    return this.database
      .prepare(
        "SELECT payload FROM records WHERE pk=? AND substr(sk,1,?)=? ORDER BY sk",
      )
      .all(pk, prefix.length, prefix)
      .map((row) => JSON.parse(row.payload as string) as T);
  }
  async acquire(key: string, token: string): Promise<boolean> {
    return Boolean(
      this.database
        .prepare(
          "INSERT INTO locks VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET token=excluded.token,expires=excluded.expires WHERE locks.expires<=?",
        )
        .run(key, token, Date.now() + 140000, Date.now()).changes,
    );
  }
  async release(key: string, token: string): Promise<void> {
    this.database
      .prepare("DELETE FROM locks WHERE id=? AND token=?")
      .run(key, token);
  }
}

export class DynamoStore implements Store {
  readonly client: DynamoDBDocumentClient;
  constructor(
    private table: string,
    region: string,
  ) {
    this.client = DynamoDBDocumentClient.from(
      new DynamoDBClient({ region, maxAttempts: 3 }),
      { marshallOptions: { removeUndefinedValues: true } },
    );
  }
  async commit(
    writes: Array<{ pk: string; sk: string; value: object }>,
  ): Promise<void> {
    await this.client.send(
      new TransactWriteCommand({
        TransactItems: writes.map(({ pk, sk, value }) => ({
          Put: { TableName: this.table, Item: { ...value, pk, sk } },
        })),
      }),
    );
  }
  async get<T>(pk: string, sk: string): Promise<T | undefined> {
    const { Item } = await this.client.send(
      new GetCommand({
        TableName: this.table,
        Key: { pk, sk },
        ConsistentRead: true,
      }),
    );
    return Item as T | undefined;
  }
  async put(pk: string, sk: string, value: object): Promise<void> {
    await this.client.send(
      new PutCommand({ TableName: this.table, Item: { ...value, pk, sk } }),
    );
  }
  async list<T>(pk: string, prefix: string): Promise<T[]> {
    const items: T[] = [];
    for await (const page of paginateQuery(
      { client: this.client },
      {
        TableName: this.table,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        ExpressionAttributeValues: { ":pk": pk, ":prefix": prefix },
        ConsistentRead: true,
      },
    ))
      items.push(...((page.Items ?? []) as T[]));
    return items;
  }
  async acquire(key: string, token: string): Promise<boolean> {
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.table,
          Item: {
            pk: `lock#${key}`,
            sk: "lease",
            token,
            expires: Date.now() + 140000,
          },
          ConditionExpression: "attribute_not_exists(pk) OR expires <= :now",
          ExpressionAttributeValues: { ":now": Date.now() },
        }),
      );
      return true;
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === "ConditionalCheckFailedException"
      )
        return false;
      throw error;
    }
  }
  async release(key: string, token: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteCommand({
          TableName: this.table,
          Key: { pk: `lock#${key}`, sk: "lease" },
          ConditionExpression: "#token = :token",
          ExpressionAttributeNames: { "#token": "token" },
          ExpressionAttributeValues: { ":token": token },
        }),
      );
    } catch (error) {
      if (!(
        error instanceof Error &&
        error.name === "ConditionalCheckFailedException"
      ))
        throw error;
    }
  }
}
