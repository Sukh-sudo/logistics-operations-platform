import { useParams } from 'react-router-dom';
import { FleetAssetDetailPage } from './FleetAssetDetailPage';

export function DriverDetailPage() {
  const { driverId = '' } = useParams();
  return <FleetAssetDetailPage kind="driver" id={driverId}/>;
}
