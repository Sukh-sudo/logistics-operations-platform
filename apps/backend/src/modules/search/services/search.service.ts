import { Injectable, NotFoundException,} from '@nestjs/common';
import { PrismaService }
from '../../../infrastructure/prisma/prisma.service';
import { SearchAssetType } from '../dto/search-query.dto';

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

async search(value: string, type?: SearchAssetType) {
  const barcode = value.trim().toUpperCase();
  // Package
  const packageSnapshot =
    type && type !== SearchAssetType.PACKAGE ? null :
    await this.prisma.packageSnapshot.findUnique({
      where: { trackingNumber: barcode },
    });

  if (packageSnapshot) {
    return {
      type: 'PACKAGE',
      data: packageSnapshot,
    };
  }

  // Container
  const containerSnapshot =
    type && type !== SearchAssetType.CONTAINER ? null :
    await this.prisma.containerSnapshot.findUnique({
      where: { containerBarcode: barcode },
    });

  if (containerSnapshot) {
    return {
      type: 'CONTAINER',
      data: containerSnapshot,
    };
  }

  // Trailer
  const trailerSnapshot =
    type && type !== SearchAssetType.TRAILER ? null :
    await this.prisma.trailerSnapshot.findUnique({
      where: { trailerBarcode: barcode },
    });

  if (trailerSnapshot) {
    return {
      type: 'TRAILER',
      data: trailerSnapshot,
    };
  }

  throw new NotFoundException(
    'Asset not found',
  );
}

}
