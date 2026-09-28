import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type { IncomingObjectStore } from "../../application/request-book-upload.js";
import { errorMessage, errorName, logger } from "../observability/logger.js";

export class S3IncomingObjectStore implements IncomingObjectStore {
  constructor(
    private readonly bucket: string,
    private readonly client: S3Client = new S3Client({
      region: process.env.AWS_REGION ?? "us-east-1",
    }),
  ) {}

  async putJson(key: string, body: Record<string, unknown>): Promise<void> {
    logger.info("s3.put_json.received", { bucket: this.bucket, key });
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: JSON.stringify(body),
          ContentType: "application/json",
        }),
      );
      logger.info("s3.put_json.responded", { bucket: this.bucket, key });
    } catch (error) {
      logger.error("s3.put_json.failed", {
        bucket: this.bucket,
        key,
        error_name: errorName(error),
        error: errorMessage(error),
      });
      throw error;
    }
  }

  async presignPut(
    key: string,
    contentType: string,
    expiresIn: number,
  ): Promise<string> {
    logger.info("s3.presign_put.received", {
      bucket: this.bucket,
      key,
      content_type: contentType,
      expires_in: expiresIn,
    });
    try {
      const url = await getSignedUrl(
        this.client,
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          ContentType: contentType,
        }),
        { expiresIn },
      );
      logger.info("s3.presign_put.responded", {
        bucket: this.bucket,
        key,
        url_chars: url.length,
      });
      return url;
    } catch (error) {
      logger.error("s3.presign_put.failed", {
        bucket: this.bucket,
        key,
        error_name: errorName(error),
        error: errorMessage(error),
      });
      throw error;
    }
  }
}
