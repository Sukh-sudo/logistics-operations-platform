import { Injectable, OnModuleInit } from '@nestjs/common';

import {
  Kafka,
  Producer,
} from 'kafkajs';
import { logApplicationEvent } from '../../common/utils/logger';

@Injectable()
export class KafkaService implements OnModuleInit {
  // Kafka producer instance
  private producer: Producer | null = null;

  // Track whether Kafka connection succeeded
  private isConnected = false;

  async onModuleInit() {
    try {
      // Initialize Kafka client
      const kafka = new Kafka({
        clientId: 'logistics-platform',

        brokers: [
          process.env.KAFKA_BROKER || 'localhost:9092',
        ],

        // Reduce retry noise during development/tests
        retry: {
          retries: 0,
        },
      });

      // Create producer instance
      this.producer = kafka.producer();

      // Attempt broker connection
      await this.producer.connect();

      // Mark Kafka as available
      this.isConnected = true;

      logApplicationEvent('log', KafkaService.name, 'Kafka producer connected');
    } catch (error) {
      // Gracefully continue without Kafka
      this.isConnected = false;

      logApplicationEvent('warn', KafkaService.name, 'Kafka broker unavailable; running without event streaming');
    }
  }

  async publish(topic: string, message: unknown) {
    // Skip publishing if Kafka unavailable
    if (!this.producer || !this.isConnected) {
      logApplicationEvent('warn', KafkaService.name, 'Skipping Kafka publish because the broker is unavailable', {
        topic,
        correlationId: this.correlationId(message),
      });

      return;
    }

    try {
      // Publish event payload
      await this.producer.send({
        topic,
        messages: [
          {
            value: JSON.stringify(message),
          },
        ],
      });
    } catch (error) {
      // Prevent Kafka failures from crashing operational workflow
      logApplicationEvent('error', KafkaService.name, 'Kafka event publication failed', {
        topic,
        correlationId: this.correlationId(message),
      });
    }
  }

  isHealthy() {
    return this.isConnected;
  }

  private correlationId(message: unknown) {
    if (message && typeof message === 'object' && 'requestId' in message) {
      return String(message.requestId);
    }
    return null;
  }
}
