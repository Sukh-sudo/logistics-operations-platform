import type { RequestWithId } from '../../../common/middleware/request-id.middleware';
import type { AuthenticatedUser } from './authenticated-user.interface';

export interface AuthenticatedRequest extends RequestWithId {
  user: AuthenticatedUser;
}
