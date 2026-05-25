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

  private producer: Producer | null = null;

  async onModuleInit() {
    try {
    // Initialize Kafka client
    const kafka = new Kafka({
    clientId: 'logistics-platform',brokers: [process.env.KAFKA_BROKER || 'localhost:9092',],
    retry: {
        retries: 2, // Reduce retry noise during local development
    },
    });

      // Create producer instance
      this.producer = kafka.producer();

      // Attempt broker connection
      await this.producer.connect();

      this.logger.log('Kafka producer connected');
    } catch (error) {
      // Allow application to continue without Kafka
      this.logger.warn(
        'Kafka broker unavailable. Running without event streaming.',
      );
    }
  }

  async publish(topic: string, message: unknown) {
    // Skip publish if Kafka is unavailable
    if (!this.producer) {
      this.logger.warn(
        `Skipping Kafka publish for topic: ${topic}`,
      );

      return;
    }

    // Publish event payload
    await this.producer.send({
      topic,
      messages: [
        {
          value: JSON.stringify(message),
        },
      ],
    });
  }
}