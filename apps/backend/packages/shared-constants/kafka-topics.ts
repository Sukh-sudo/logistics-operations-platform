// Centralized Kafka topic definitions
// Keeps topic names consistent across producers and consumers
export const KAFKA_TOPICS = {
  // Package operational lifecycle events
  PACKAGE_EVENTS: 'package-events',

  // Future shipment lifecycle events
  SHIPMENT_EVENTS: 'shipment-events',

  // Future terminal operational metrics/events
  TERMINAL_EVENTS: 'terminal-events',

  // Future analytics aggregation events
  ANALYTICS_EVENTS: 'analytics-events',
} as const;