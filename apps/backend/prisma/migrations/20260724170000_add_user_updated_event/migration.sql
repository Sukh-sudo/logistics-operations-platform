-- Profile changes are business facts and must be represented in the user
-- aggregate's immutable event stream.
ALTER TYPE "UserEventType" ADD VALUE IF NOT EXISTS 'USER_UPDATED';
