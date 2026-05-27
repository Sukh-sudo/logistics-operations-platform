import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';

import {
  Kafka,
  Producer,
} from 'kafkajs';

@Injectable()
export class KafkaService implements OnModuleInit {
  private readonly logger = new Logger(KafkaService.name);

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

      this.logger.log('Kafka producer connected');
    } catch (error) {
      // Gracefully continue without Kafka
      this.isConnected = false;

      this.logger.warn(
        'Kafka broker unavailable. Running without event streaming.',
      );
    }
  }

  async publish(topic: string, message: unknown) {
    // Skip publishing if Kafka unavailable
    if (!this.producer || !this.isConnected) {
      this.logger.warn(
        `Skipping Kafka publish for topic: ${topic}`,
      );

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
      this.logger.error(
        `Failed to publish Kafka event for topic: ${topic}`,
      );
    }
  }
}