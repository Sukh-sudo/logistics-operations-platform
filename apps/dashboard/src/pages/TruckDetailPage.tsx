import { useParams } from 'react-router-dom';
import { FleetAssetDetailPage } from './FleetAssetDetailPage';

export function TruckDetailPage() {
  const { truckId = '' } = useParams();
  return <FleetAssetDetailPage kind="truck" id={truckId}/>;
}
